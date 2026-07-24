// Express'ten Router, Request ve Response'u import ediyoruz.
// Router: URL yollarını (route) tanımlamak için kullanıyoruz.
// Request: gelen HTTP isteğini temsil ediyor (mesela URL'deki parametreler buradan okunuyor).
// Response: geri göndereceğimiz cevabı temsil ediyor (mesela res.json ile JSON dönüyoruz).
import { Router, Request, Response } from 'express';

// client.ts dosyasında oluşturduğumuz appsV1Api'yi import ediyoruz.
// appsV1Api deployment'larla çalışmak için gerekli, pods.ts'de CoreV1Api kullanmıştık,
// bu sefer deployment'lar farklı API grubunda olduğu için AppsV1Api kullanıyoruz.
import { appsV1Api } from '../k8s/client';

// Router'dan bir örnek oluşturuyoruz.
// Bu router, /api/deployments altındaki istekleri yönetecek.
const router = Router();

// Deployment arayüzü (interface) tanımlıyoruz.
// TypeScript'te interface, bir nesnenin hangi alanlara sahip olması gerektiğini söyleyen bir şablon.
// Kubernetes'ten gelen büyük deployment objesinden sadece bize lazım olan 4 alanı seçiyoruz.
interface Deployment {
  name: string;         // Deployment'ın ismi, örneğin "nginx-deployment"
  namespace: string;    // Hangi namespace'de olduğu, genelde "default"
  replicas: number;     // Toplamda kaç pod çalışması isteniyor (hedef sayı)
  readyReplicas: number; // Şu an kaç pod hazır ve çalışıyor (gerçek sayı)
}

// GET isteği için bir route tanımlıyoruz.
// '/' diyoruz çünkü bu router zaten /api/deployments altında tanımlı (bunu index.ts yapıyor),
// yani tam yol: GET /api/deployments
// async kullanıyoruz çünkü Kubernetes'e soru sormak zaman alıyor, await ile bekliyoruz.
router.get('/', async (req: Request, res: Response) => {

  // URL'den namespace parametresini okuyoruz.
  // Örneğin: GET /api/deployments?namespace=kube-system gelirse namespace = "kube-system" olur.
  // Eğer namespace parametresi gönderilmezse varsayılan olarak "default" kullanıyoruz.
  // "as string" diyoruz çünkü TypeScript req.query'nin string mi array mi olduğunu bilmiyor,
  // biz ona "bu string" diye garanti veriyoruz.
  const namespace = (req.query.namespace as string) || 'default';

  try {
    // Kubernetes API'sine soruyor: "Bu namespace'deki deployment'ları listele"
    // await diyoruz çünkü bu işlem biraz zaman alıyor, cevap gelene kadar bekliyoruz.
    // Gelen result içinde items dizisi var ve her item bir deployment'ın tüm detaylarını taşıyor.
    const result = await appsV1Api.listNamespacedDeployment({ namespace });

    // result.items dizisini map ile dönüştürüyoruz.
    // Her deployment için sadece bize lazım olan 4 alanı alıp yeni bir obje yapıyoruz.
    // Böylece Angular'a çok daha küçük ve temiz bir JSON gönderiyoruz.
    const deployments: Deployment[] = result.items.map(dep => ({

      // dep.metadata?.name kısmındaki "?" işareti şu demek:
      // "metadata alanı var mı? Varsa name'e bak, yoksa hata verme, undefined dön."
      // "??" ise şu demek: "sol taraf null veya undefined ise sağ taraftaki değeri kullan."
      // Yani metadata yoksa veya name yoksa 'unknown' yazıyoruz.
      name: dep.metadata?.name ?? 'unknown',

      namespace: dep.metadata?.namespace ?? 'unknown',

      // spec.replicas, Kubernetes'e "kaç pod olsun istiyorum" diye söylediğimiz sayı.
      // Eğer bu alan yoksa 0 yazıyoruz (sayısal alan olduğu için 'unknown' değil 0 kullanıyoruz).
      replicas: dep.spec?.replicas ?? 0,

      // status.readyReplicas ise şu an gerçekten hazır olan pod sayısı.
      // replicas ile aynıysa deployment tam çalışıyor demek, farklıysa bir şeyler yükleniyor demek.
      readyReplicas: dep.status?.readyReplicas ?? 0,
    }));

    // Hazırladığımız deployment listesini JSON formatında geri gönderiyoruz.
    // Angular tarafında bu JSON'ı alıp tabloya dönüştüreceğiz.
    res.json(deployments);

  } catch (error: unknown) {
    // Eğer Kubernetes'e bağlanamadıysak veya başka bir hata olduysa buraya düşüyoruz.
    // TypeScript'te catch bloğundaki error tipi "unknown" çünkü her şey hata olabilir.
    // Error instance'ı mı diye kontrol edip mesajı alıyoruz, değilse genel mesaj yazıyoruz.
    const message = error instanceof Error ? error.message : 'Unknown error';

    // HTTP 500 kodu "sunucu hatası" demek. JSON içinde hata mesajını gönderiyoruz.
    res.status(500).json({ error: message });
  }
});

// Bu router'ı dışarıya export ediyoruz ki index.ts onu /api/deployments yoluna bağlayabilsin.
export default router;
