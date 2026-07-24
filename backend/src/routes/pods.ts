// Express'ten Router, Request ve Response'u import ediyoruz.
// Router: URL yollarını (route) tanımlamak için kullanıyoruz.
// Request: gelen HTTP isteğini temsil ediyor (mesela URL'deki parametreler buradan okunuyor).
// Response: geri göndereceğimiz cevabı temsil ediyor (mesela res.json ile JSON dönüyoruz).
import { Router, Request, Response } from 'express';

// client.ts dosyasında oluşturduğumuz ve export ettiğimiz Kubernetes API istemcisini alıyoruz.
// Artık bu dosyada da Kubernetes'e sorgu atabiliriz.
import { coreV1Api } from '../k8s/client';

// Router'dan bir örnek oluşturuyoruz.
// Bu router, /api/pods altındaki istekleri yönetecek.
const router = Router();

// Pod arayüzü (interface) tanımlıyoruz.
// TypeScript'te interface, bir nesnenin hangi alanlara sahip olması gerektiğini söyleyen bir şablon.
// Biz Angular'a sadece name, status ve namespace bilgilerini göndermek istiyoruz,
// Kubernetes'ten gelen dev obje içinde çok fazla gereksiz bilgi var.
interface Pod {
  name: string;      // Pod'un ismi, örneğin "nginx-test"
  status: string;    // Pod'un durumu, örneğin "Running", "Pending", "Failed"
  namespace: string; // Pod'un hangi namespace'de olduğu, genelde "default"
}

// GET isteği için bir route tanımlıyoruz.
// '/' diyoruz çünkü bu router zaten /api/pods altında tanımlı (bunu index.ts yapıyor),
// yani tam yol: GET /api/pods
// async kullanıyoruz çünkü Kubernetes'e soru sormak zaman alıyor, await ile bekliyoruz.
router.get('/', async (req: Request, res: Response) => {

  // URL'den namespace parametresini okuyoruz.
  // Örneğin: GET /api/pods?namespace=kube-system gelirse namespace = "kube-system" olur.
  // Eğer namespace parametresi gönderilmezse varsayılan olarak "default" kullanıyoruz.
  // "as string" diyoruz çünkü TypeScript req.query'nin string mi array mi olduğunu bilmiyor,
  // biz ona "bu string" diye garanti veriyoruz.
  const namespace = (req.query.namespace as string) || 'default';

  try {
    // Kubernetes API'sine soruyor: "Bu namespace'deki pod'ları listele"
    // await diyoruz çünkü bu işlem biraz zaman alıyor, cevap gelene kadar bekliyoruz.
    // Gelen result içinde items dizisi var ve her item bir pod'un tüm detaylarını taşıyor.
    const result = await coreV1Api.listNamespacedPod({ namespace });

    // result.items dizisini map ile dönüştürüyoruz.
    // Her pod için sadece bize lazım olan 3 alanı alıp yeni bir obje yapıyoruz.
    // Böylece Angular'a çok daha küçük ve temiz bir JSON gönderiyoruz.
    const pods: Pod[] = result.items.map(pod => ({

      // pod.metadata?.name kısmındaki "?" işareti şu demek:
      // "metadata alanı var mı? Varsa name'e bak, yoksa hata verme, undefined dön."
      // "??" ise şu demek: "sol taraf null veya undefined ise sağ taraftaki değeri kullan."
      // Yani metadata yoksa veya name yoksa 'unknown' yazıyoruz.
      name: pod.metadata?.name ?? 'unknown',

      // Pod'un durumu: Running, Pending, Failed, Succeeded gibi değerler alabilir.
      // status?.phase kısmında da aynı "?" ve "??" mantığı geçerli.
      status: pod.status?.phase ?? 'unknown',

      // Pod'un hangi namespace'de olduğunu da ekliyoruz.
      namespace: pod.metadata?.namespace ?? 'unknown',
    }));

    // Hazırladığımız pod listesini JSON formatında geri gönderiyoruz.
    // Angular tarafında bu JSON'ı alıp tabloya dönüştüreceğiz.
    res.json(pods);

  } catch (error: unknown) {
    // Eğer Kubernetes'e bağlanamadıysak veya başka bir hata olduysa buraya düşüyoruz.
    // TypeScript'te catch bloğundaki error tipi "unknown" çünkü her şey hata olabilir.
    // Error instance'ı mı diye kontrol edip mesajı alıyoruz, değilse genel mesaj yazıyoruz.
    const message = error instanceof Error ? error.message : 'Unknown error';

    // HTTP 500 kodu "sunucu hatası" demek. JSON içinde hata mesajını gönderiyoruz.
    res.status(500).json({ error: message });
  }
});

// Bu router'ı dışarıya export ediyoruz ki index.ts onu /api/pods yoluna bağlayabilsin.
export default router;
