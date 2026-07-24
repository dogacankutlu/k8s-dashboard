// Angular'ın Injectable dekoratörünü import ediyoruz.
// Injectable, bu sınıfın bir servis olduğunu Angular'a söylüyor.
// Servisler, component'ların içine "enjekte edilebilir" (inject edilebilir) yani otomatik verilir.
import { Injectable } from '@angular/core';

// Angular'ın HTTP istemcisini import ediyoruz.
// HttpClient ile backend'e GET, POST gibi HTTP istekleri atabiliriz.
import { HttpClient } from '@angular/common/http';

// RxJS'den Observable'ı import ediyoruz.
// Observable, zamanla birden fazla değer üretebilen bir yapı.
// Mesela HTTP isteği sonunda bir cevap gelir, bu bir Observable'dır.
// WebSocket'te ise her log satırı ayrı bir değer olarak gelir.
import { Observable } from 'rxjs';

// Pod arayüzü (interface) tanımlıyoruz ve export ediyoruz.
// Export ediyoruz ki app.ts de bu tipi kullanabilsin.
// Bu interface, backend'den gelen JSON'ın yapısını tanımlıyor.
export interface Pod {
  name: string;      // Pod'un ismi
  status: string;    // Pod'un durumu (Running, Pending, Failed gibi)
  namespace: string; // Pod'un namespace'i
}

// Deployment arayüzü tanımlıyoruz ve export ediyoruz.
export interface Deployment {
  name: string;          // Deployment'ın ismi
  namespace: string;     // Deployment'ın namespace'i
  replicas: number;      // İstenen pod sayısı
  readyReplicas: number; // Hazır pod sayısı
}

// @Injectable dekoratörü bu sınıfı Angular servisine dönüştürüyor.
// providedIn: 'root' diyoruz yani bu servis tüm uygulama boyunca tek bir örnek olarak var olacak.
// Her component aynı servis örneğini kullanır, her biri ayrı ayrı oluşturmaz.
@Injectable({
  providedIn: 'root'
})
export class KubernetesService {

  // Backend'in adresi. İstekleri bu adrese gönderiyoruz.
  // "private" diyoruz çünkü bu değişken sadece bu sınıfın içinden kullanılacak.
  private baseUrl = 'http://localhost:3000';

  // constructor: servis oluşturulduğunda çalışan özel metod.
  // "private http: HttpClient" diyerek Angular'dan HttpClient'ı istiyoruz (dependency injection).
  // Angular bunu otomatik olarak sağlıyor, biz new HttpClient() yazmak zorunda kalmıyoruz.
  constructor(private http: HttpClient) {}

  // Pod listesini backend'den çeken metod.
  // namespace parametresi opsiyonel, verilmezse varsayılan olarak 'default' kullanılıyor.
  // Observable<Pod[]> dönüyor: yani bu metod zamanla bir Pod dizisi verecek bir Observable döndürüyor.
  getPods(namespace: string = 'default'): Observable<Pod[]> {
    // http.get ile GET isteği atıyoruz.
    // <Pod[]> diyerek TypeScript'e "gelen cevap Pod dizisi olacak" diye söylüyoruz.
    // Şablon literal ile namespace'i URL'ye ekliyoruz: /api/pods?namespace=default gibi.
    return this.http.get<Pod[]>(`${this.baseUrl}/api/pods?namespace=${namespace}`);
  }

  // Deployment listesini backend'den çeken metod.
  // getPods ile aynı mantık, sadece endpoint ve dönüş tipi farklı.
  getDeployments(namespace: string = 'default'): Observable<Deployment[]> {
    return this.http.get<Deployment[]>(`${this.baseUrl}/api/deployments?namespace=${namespace}`);
  }

  // Pod loglarını canlı olarak akışla getiren metod.
  // HTTP yerine WebSocket kullanıyoruz çünkü loglar sürekli geliyor.
  // Observable<string> dönüyor: her yeni log satırı bir string olarak gelecek.
  streamLogs(podName: string, namespace: string = 'default'): Observable<string> {

    // new Observable ile manuel bir Observable oluşturuyoruz.
    // observer: bu Observable'a abone olan kişiye veri göndermemizi sağlıyor.
    return new Observable(observer => {

      // Tarayıcının yerleşik WebSocket sınıfını kullanarak bağlantı açıyoruz.
      // URL'ye pod ismini ve namespace'i parametre olarak ekliyoruz.
      // Backend bu parametreleri okuyup o pod'un loglarını akıtmaya başlayacak.
      const ws = new WebSocket(`ws://localhost:3000?pod=${podName}&namespace=${namespace}`);

      // Sunucudan mesaj geldiğinde bu fonksiyon çalışıyor.
      // observer.next ile gelen log satırını Observable'ı dinleyenlere iletiyoruz.
      // app.ts'de subscribe ettiğimiz "next" fonksiyonu buradan geliyor.
      ws.onmessage = event => observer.next(event.data);

      // Bir hata olursa (bağlantı kurulamadı gibi) bu fonksiyon çalışıyor.
      // observer.error ile hatayı iletiyoruz. Subscribe'daki "error" fonksiyonu bunu yakalar.
      ws.onerror = () => observer.error('WebSocket error');

      // Bağlantı kapandığında bu fonksiyon çalışıyor.
      // observer.complete() diyerek "artık yeni değer gelmeyecek" diyoruz.
      ws.onclose = () => observer.complete();

      // Bu fonksiyon, Observable'a abone olan kişi aboneliği iptal ettiğinde çalışıyor.
      // Mesela kullanıcı "Close" butonuna basınca app.ts logSubscription.unsubscribe() çağırıyor.
      // Bu da buraya geliyor ve WebSocket bağlantısını kapatıyor.
      // Böylece kullanıcı log görüntülemesini kapattığında arka planda bağlantı açık kalmıyor.
      return () => ws.close();
    });
  }
}
