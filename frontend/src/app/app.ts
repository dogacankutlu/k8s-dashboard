// Angular'dan ihtiyacımız olan şeyleri import ediyoruz.
// Component: bu sınıfın bir Angular component'ı olduğunu belirtiyor.
// OnInit: sayfa yüklendiğinde çalışacak ngOnInit metodunu kullanmak için gerekli.
// OnDestroy: component yok edildiğinde (sayfa kapandığında) çalışacak ngOnDestroy için gerekli.
// ChangeDetectorRef: Angular'a "ekranı güncelle" diye manuel söylememizi sağlıyor.
import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';

// RxJS'den Subscription import ediyoruz.
// Subscription, bir Observable'a abone olunduğunda dönen nesnedir.
// Bunu saklıyoruz ki ileride aboneliği iptal edebilelim (WebSocket'i kapatalım).
import { Subscription } from 'rxjs';

// Kendi yazdığımız servisi ve interface'leri import ediyoruz.
// KubernetesService: pod, deployment ve log verilerini çekiyor.
// Pod ve Deployment: TypeScript tip tanımları, değişken tiplerini belirtmek için kullanıyoruz.
import { KubernetesService, Pod, Deployment } from './kubernetes.service';

// @Component dekoratörü bu sınıfın bir Angular component'ı olduğunu söylüyor.
// selector: HTML'de bu component'ı <app-root> etiketi ile kullanabiliriz.
// templateUrl: component'ın görünümünün hangi HTML dosyasında olduğunu belirtiyor.
// standalone: false diyoruz çünkü bu project AppModule kullanan eski stil modül yapısında.
// styleUrl: CSS dosyasının yolunu belirtiyor.
@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  standalone: false,
  styleUrl: './app.css'
})

// OnInit ve OnDestroy interface'lerini "implements" ediyoruz.
// Bu, ngOnInit ve ngOnDestroy metodlarını yazmak zorunda olduğumuzu söylüyor.
export class App implements OnInit, OnDestroy {

  // Ekranda gösterilecek pod listesi. Başlangıçta boş dizi.
  // Pod[] tipi: Pod arayüzüne uyan objelerin dizisi.
  pods: Pod[] = [];

  // Ekranda gösterilecek deployment listesi. Başlangıçta boş dizi.
  deployments: Deployment[] = [];

  // Şu an logları görüntülenen pod'un ismi.
  // null diyoruz çünkü başlangıçta hiçbir pod seçili değil.
  // HTML'de *ngIf="selectedPod" ile log panelini göstermek/gizlemek için kullanıyoruz.
  selectedPod: string | null = null;

  // Gelen log satırlarını saklayan dizi.
  logLines: string[] = [];

  // WebSocket aboneliğini saklayan değişken.
  // "private" çünkü sadece bu sınıfın içinden kullanılıyor.
  // Subscription | null: ya bir Subscription objesi ya da null olabilir.
  private logSubscription: Subscription | null = null;

  // constructor: component oluşturulduğunda Angular tarafından çağrılır.
  // "private k8s: KubernetesService" diyerek Angular'dan KubernetesService'i istiyoruz.
  // "private cdr: ChangeDetectorRef" diyerek Angular'dan change detector'ı istiyoruz.
  // Angular bu nesneleri otomatik sağlıyor (dependency injection).
  constructor(private k8s: KubernetesService, private cdr: ChangeDetectorRef) {}

  // ngOnInit: component ekrana yüklendiğinde (sayfa açıldığında) otomatik çalışır.
  // Burada pod ve deployment listelerini yüklemeye başlıyoruz.
  ngOnInit(): void {
    this.loadPods();
    this.loadDeployments();
  }

  // Pod listesini yükleyen metod.
  loadPods(): void {
    // k8s.getPods() bir Observable döndürüyor.
    // .subscribe() ile bu Observable'a abone oluyoruz, yani "veri gelince şunu yap" diyoruz.
    this.k8s.getPods().subscribe({

      // next: veri başarıyla geldiğinde bu fonksiyon çalışıyor.
      // data: backend'den gelen Pod dizisi.
      next: data => {
        // Konsolda log basıyoruz. Geliştirme sırasında sorun çözmeye yarıdı.
        // Tarayıcıda F12 > Console kısmında görebilirsin.
        console.log('Pods received:', data);

        // Gelen veriyi pods değişkenine atıyoruz.
        this.pods = data;

        // Angular 19'da HTTP cevabı Angular'ın değişiklik dedektörü dışında geliyor.
        // detectChanges() diyerek Angular'a "değişiklik oldu, ekranı güncelle" diyoruz.
        // Bu olmadan tablo boş kalıyordu veri gelmesine rağmen.
        this.cdr.detectChanges();
      },

      // error: bir hata olursa bu fonksiyon çalışıyor.
      error: err => console.error('Failed to load pods:', err)
    });
  }

  // Deployment listesini yükleyen metod. loadPods ile aynı mantık.
  loadDeployments(): void {
    this.k8s.getDeployments().subscribe({
      next: data => {
        this.deployments = data;
        this.cdr.detectChanges();
      },
      error: err => console.error('Failed to load deployments:', err)
    });
  }

  // Log panelini açan metod. HTML'de "View Logs" butonuna basınca çağrılıyor.
  // podName: hangi pod'un logları görüntülenecek.
  viewLogs(podName: string): void {

    // Seçilen pod'un ismini kaydediyoruz.
    // HTML'de *ngIf="selectedPod" bu değişkene bakıyor, null değilse log panelini gösteriyor.
    this.selectedPod = podName;

    // Log satırlarını sıfırlıyoruz. Yeni bir pod seçilince eski loglar temizlensin.
    this.logLines = [];

    // Eğer önceki bir WebSocket aboneliği varsa onu iptal ediyoruz.
    // Kullanıcı başka bir pod'un loglarına geçmek isteyebilir.
    // Eski aboneliği kapatmadan yenisini açarsak iki pod'un logları karışır.
    if (this.logSubscription) {
      this.logSubscription.unsubscribe();
    }

    // Yeni bir WebSocket aboneliği başlatıyoruz.
    // streamLogs(): WebSocket bağlantısı açan Observable döndürüyor.
    // Her yeni log satırı "next" fonksiyonuna geliyor.
    this.logSubscription = this.k8s.streamLogs(podName).subscribe({
      next: line => {
        // Yeni log satırını diziye ekliyoruz.
        // push() yerine spread operatörü [...this.logLines, line] kullanıyoruz.
        // Neden? Angular dizinin içindeki değişimi fark etmiyor, ama yeni bir dizi atayınca fark ediyor.
        // push() eski diziyi mutasyona uğratıyor (değiştiriyor), Angular bunu görmüyor.
        // Yeni dizi oluşturuyoruz ki Angular ekranı güncellesin.
        this.logLines = [...this.logLines, line];

        // Angular'a "ekranı güncelle" diyoruz.
        this.cdr.detectChanges();
      },
      error: err => {
        // Hata olursa onu da log listesine ekliyoruz ki kullanıcı görsün.
        this.logLines = [...this.logLines, `Error: ${err}`];
        this.cdr.detectChanges();
      }
    });
  }

  // Log panelini kapatan metod. HTML'de "Close" butonuna basınca çağrılıyor.
  closeLogs(): void {

    // selectedPod'u null yapınca *ngIf="selectedPod" false oluyor ve log paneli kaybolur.
    this.selectedPod = null;

    // Log satırlarını temizliyoruz.
    this.logLines = [];

    // WebSocket aboneliğini kapatıyoruz.
    // Bu da kubernetes.service.ts'deki "return () => ws.close()" fonksiyonunu tetikliyor.
    // Yani WebSocket bağlantısı gerçekten kapanıyor, arka planda açık kalmıyor.
    if (this.logSubscription) {
      this.logSubscription.unsubscribe();
      this.logSubscription = null;
    }
  }

  // Bir log satırının hata mı olduğunu kontrol eden yardımcı metod.
  // HTML'de bu metodun sonucuna göre kırmızı renk CSS sınıfı ekleniyor.
  isErrorLine(line: string): boolean {
    // Satırda "error" veya "warn" kelimesi geçiyorsa true dönüyor.
    // toLowerCase() ile büyük/küçük harf farkını görmezden geliyoruz.
    return line.toLowerCase().includes('error') || line.toLowerCase().includes('warn');
  }

  // ngOnDestroy: component yok edildiğinde (kullanıcı sayfadan ayrıldığında) otomatik çalışır.
  // Sayfadan ayrılınca açık WebSocket bağlantısı kalmasın diye aboneliği kapatıyoruz.
  ngOnDestroy(): void {
    if (this.logSubscription) {
      this.logSubscription.unsubscribe();
    }
  }
}
