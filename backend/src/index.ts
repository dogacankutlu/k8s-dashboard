// Express kütüphanesini import ediyoruz.
// Express, Node.js üzerinde web sunucusu ve API oluşturmamızı kolaylaştırıyor.
import express from 'express';

// cors paketini import ediyoruz.
// CORS (Cross-Origin Resource Sharing): tarayıcılar güvenlik nedeniyle farklı portlardan gelen
// istekleri varsayılan olarak engelliyor. Angular port 4200'de, backend port 3000'de çalışıyor.
// cors paketi bu engeli kaldırıyor, Angular'ın backend'e istek atmasına izin veriyor.
import cors from 'cors';

// ws paketinden WebSocketServer ve WebSocket sınıflarını import ediyoruz.
// WebSocketServer: WebSocket bağlantılarını dinleyen sunucu.
// WebSocket: bağlanan her bir istemciyi temsil eden sınıf (bağlantı durumunu kontrol etmek için).
import { WebSocketServer, WebSocket } from 'ws';

// Node.js'in yerleşik http modülünden createServer'ı import ediyoruz.
// Normalde Express kendi HTTP sunucusunu yönetir, ama biz WebSocket'i de aynı porta
// bağlamak istiyoruz. Bunun için Express'i manuel bir HTTP sunucusunun içine sarıyoruz.
import { createServer } from 'http';

// Node.js'in URL modülünden URL sınıfını import ediyoruz.
// WebSocket isteği geldiğinde URL'yi parse etmek için kullanıyoruz.
// Örneğin: ws://localhost:3000?pod=nginx-test&namespace=default gibi bir URL'den
// pod ve namespace değerlerini okumak için URL sınıfını kullanıyoruz.
import { URL } from 'url';

// Node.js'in stream modülünden PassThrough'u import ediyoruz.
// PassThrough bir geçiş akışı (stream). Kubernetes'ten gelen log verilerini
// içinden geçirip WebSocket'e iletmek için kullanıyoruz.
// Bunu bir boru gibi düşünebilirsin: Kubernetes → PassThrough boru → WebSocket → tarayıcı
import { PassThrough } from 'stream';

// Kubernetes kütüphanesini import ediyoruz.
// k8s.Log sınıfı ile pod loglarını akış (stream) halinde alabileceğiz.
import * as k8s from '@kubernetes/client-node';

// Kendi yazdığımız route dosyalarını import ediyoruz.
// podsRouter: /api/pods endpoint'ini yönetiyor.
// deploymentsRouter: /api/deployments endpoint'ini yönetiyor.
import podsRouter from './routes/pods';
import deploymentsRouter from './routes/deployments';

// Express uygulaması oluşturuyoruz.
// app değişkeni artık bizim web sunucumuz, tüm ayarları buraya yapıyoruz.
const app = express();

// Sunucunun dinleyeceği port numarası.
// Port 3000 yaygın bir geliştirme portu, Angular ise 4200 kullanıyor.
const PORT = 3000;

// Kubernetes bağlantısını kuruyoruz.
// Bu kısım client.ts'e benziyor ama burada WebSocket için ayrıca lazım.
// KubeConfig: Kubernetes'e nasıl bağlanacağımızı tutan yapı.
const kubeConfig = new k8s.KubeConfig();

// ~/.kube/config dosyasını okuyoruz (minikube bunu otomatik oluşturmuştu).
kubeConfig.loadFromDefault();

// k8s.Log sınıfından bir örnek oluşturuyoruz.
// Bu sınıf bize pod loglarını stream olarak alma imkanı veriyor.
// Bunu burada bir kez oluşturuyoruz, her bağlantıda yeniden oluşturmak zorunda kalmıyoruz.
const log = new k8s.Log(kubeConfig);

// cors middleware'ini Express'e ekliyoruz.
// app.use diyerek tüm isteklerde çalışmasını sağlıyoruz.
// Artık Angular'dan gelen istekler engellenmeyecek.
app.use(cors());

// express.json() middleware'ini ekliyoruz.
// Gelen isteklerin body'sini otomatik JSON olarak parse ediyor.
// Bu projede şu an POST isteği kullanmıyoruz ama iyi bir alışkanlık olarak ekliyoruz.
app.use(express.json());

// Ana sayfaya gelen GET isteğini karşılıyoruz.
// Tarayıcıda localhost:3000 açılırsa "Kubernetes Dashboard Backend is running." yazısı görünür.
// Bu endpoint sunucunun çalışıp çalışmadığını test etmek için kullanışlı.
app.get('/', (req, res) => {
  res.send('Kubernetes Dashboard Backend is running.');
});

// Pod route'unu /api/pods yoluna bağlıyoruz.
// Artık GET /api/pods isteği geldiğinde podsRouter devreye giriyor.
app.use('/api/pods', podsRouter);

// Deployment route'unu /api/deployments yoluna bağlıyoruz.
// Artık GET /api/deployments isteği geldiğinde deploymentsRouter devreye giriyor.
app.use('/api/deployments', deploymentsRouter);

// Express uygulamasını createServer ile bir HTTP sunucusuna sarıyoruz.
// Bu şart çünkü WebSocketServer'ı da aynı sunucuya bağlayacağız.
// Eğer bunu yapmasaydık WebSocket farklı bir porta ihtiyaç duyardı.
const server = createServer(app);

// WebSocket sunucusunu oluşturuyoruz ve HTTP sunucusuna bağlıyoruz.
// Artık ws://localhost:3000 adresine WebSocket bağlantısı açılabilecek.
const wss = new WebSocketServer({ server });

// Bir WebSocket bağlantısı kurulduğunda bu kod çalışıyor.
// ws: bağlanan istemciyi temsil ediyor (buna mesaj gönderebilir, kapatabilirsin).
// req: HTTP upgrade isteği, içinde URL bilgisi var, buradan pod ismini okuyacağız.
wss.on('connection', async (ws: WebSocket, req) => {

  // Gelen URL'yi parse ediyoruz.
  // Örnek URL: ws://localhost:3000?pod=nginx-test&namespace=default
  // req.url sadece "?pod=nginx-test&namespace=default" gibi bir şey, tam URL değil.
  // Bu yüzden başına localhost:3000 ekliyoruz ki URL sınıfı düzgün parse edebilsin.
  // "?? ''" kısmı: req.url null ise boş string kullan, hata verme demek.
  const params = new URL(req.url ?? '', `http://localhost:${PORT}`).searchParams;

  // URL'den "pod" parametresini okuyoruz. Örneğin: nginx-test
  const podName = params.get('pod');

  // URL'den "namespace" parametresini okuyoruz. Yoksa varsayılan olarak "default" kullanıyoruz.
  const namespace = params.get('namespace') ?? 'default';

  // Eğer pod ismi gönderilmemişse hata mesajı gönderip bağlantıyı kapatıyoruz.
  // "!" işareti "null veya undefined ise" demek. podName boşsa içeri giriyoruz.
  if (!podName) {
    ws.send('Error: pod name is required');
    ws.close();
    return; // Fonksiyondan çıkıyoruz, aşağıdaki kod çalışmasın diye.
  }

  try {
    // PassThrough stream oluşturuyoruz.
    // Bu, Kubernetes'ten gelen log verilerini taşıyacağımız boru hattı.
    const logStream = new PassThrough();

    // logStream'e veri geldiğinde (yani Kubernetes'ten yeni bir log satırı geldiğinde)
    // bu fonksiyon çalışıyor.
    logStream.on('data', (chunk: Buffer) => {

      // WebSocket hala açık mı diye kontrol ediyoruz.
      // readyState === OPEN demek bağlantı aktif demek.
      // Kapalı bir bağlantıya mesaj göndermeye çalışmak hata verir.
      if (ws.readyState === WebSocket.OPEN) {

        // chunk bir Buffer (ham bayt verisi), toString() ile string'e çevirip gönderiyoruz.
        // Bu string Angular tarafına ulaşıyor ve ekranda log olarak görünüyor.
        ws.send(chunk.toString());
      }
    });

    // Log stream bittiğinde (pod silinirse veya log tükendiyse) WebSocket bağlantısını kapıyoruz.
    logStream.on('end', () => ws.close());

    // Kullanıcı WebSocket bağlantısını kapattığında (mesela "Close" butonuna bastığında)
    // log stream'i de yok ediyoruz. Böylece arka planda gereksiz yere log okumaya devam etmiyoruz.
    ws.on('close', () => logStream.destroy());

    // Kubernetes'ten log akışı başlatıyoruz.
    // log.log() çağrısı şunu yapıyor: "şu namespace'deki şu pod'un loglarını oku,
    // gelen verileri logStream'e yaz, follow:true diyerek yeni logları da göndermeye devam et."
    // Container ismi olarak boş string ('') veriyoruz, bu pod'daki tek container'ı seçiyor.
    await log.log(namespace, podName, '', logStream, { follow: true, pretty: false });

  } catch (error: unknown) {
    // Bir şeyler ters gittiyse (pod bulunamadı, Kubernetes'e bağlanılamadı gibi)
    // hata mesajını WebSocket üzerinden tarayıcıya gönderip bağlantıyı kapatıyoruz.
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(`Error: ${message}`);
      ws.close();
    }
  }
});

// HTTP sunucusunu başlatıyoruz. Port 3000'i dinlemeye başlıyoruz.
// Sunucu başarıyla başladığında terminalde mesaj yazıyor.
// Şablon literal kullandık: backtick `` içinde ${PORT} yazınca değer otomatik yerine geçiyor.
server.listen(PORT, () => {
  console.log(`Server started on http://localhost:${PORT}`);
});
