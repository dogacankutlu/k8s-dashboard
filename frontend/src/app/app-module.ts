// Angular'ın çekirdek modülünden NgModule ve provideBrowserGlobalErrorListeners'ı import ediyoruz.
// NgModule: bu sınıfın bir Angular modülü olduğunu söyleyen dekoratör.
// provideBrowserGlobalErrorListeners: tarayıcıdaki global hataları yakalamak için Angular 19 ile geldi.
import { NgModule, provideBrowserGlobalErrorListeners } from '@angular/core';

// BrowserModule: Angular uygulamasının tarayıcıda çalışması için temel şeyleri sağlıyor.
// Tarayıcıda çalışan her Angular uygulamasında bu olmalı.
import { BrowserModule } from '@angular/platform-browser';

// provideHttpClient: Angular 19'da HTTP istekleri yapmak için gereken fonksiyon.
// Eski yöntemde HttpClientModule vardı ama Angular 19'da bu "deprecated" yani artık önerilmiyor.
// provideHttpClient ile providers dizisine ekliyoruz.
import { provideHttpClient } from '@angular/common/http';

// CommonModule: *ngFor ve *ngIf gibi temel Angular direktiflerini kullanabilmek için gerekli.
// Angular 19'da bu direktifler otomatik gelmediği için açıkça import etmemiz gerekiyor.
// *ngFor ile dizileri tabloya dönüştürüyoruz, *ngIf ile log panelini gösterip gizliyoruz.
import { CommonModule } from '@angular/common';

// Ana component'ımızı import ediyoruz.
// App sınıfı app.ts dosyasında tanımlı, tüm pod/log mantığı orada.
import { App } from './app';

// @NgModule dekoratörü ile Angular'a modülün yapısını bildiriyoruz.
@NgModule({

  // declarations: Bu modüle ait component'ları, directive'leri ve pipe'ları tanımlıyoruz.
  // Bizim App component'ımız burada. Angular'a "bu component bu modüle ait" diyoruz.
  declarations: [
    App
  ],

  // imports: Bu modülün kullanacağı diğer Angular modüllerini belirtiyoruz.
  // BrowserModule: tarayıcı desteği için.
  // CommonModule: *ngFor, *ngIf gibi direktifler için.
  imports: [
    BrowserModule,
    CommonModule,
  ],

  // providers: Angular'ın dependency injection sistemine servisler ve fonksiyonlar ekliyoruz.
  // provideBrowserGlobalErrorListeners(): global hata yakalama.
  // provideHttpClient(): HTTP istekleri yapabilmek için gerekli.
  // Bu olmadan kubernetes.service.ts'deki HttpClient çalışmaz.
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
  ],

  // bootstrap: Uygulama başladığında ilk yüklenecek component.
  // App component'ı index.html'deki <app-root> etiketine yükleniyor.
  bootstrap: [App]
})
export class AppModule { }
