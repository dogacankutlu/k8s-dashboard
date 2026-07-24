# Kubernetes Dashboard

Talya Bilişim stajı kapsamında geliştirdiğim proje. Kubernetes üzerinde çalışan pod'ları ve deployment'ları web arayüzünden görüntülemeye ve pod loglarını gerçek zamanlı olarak izlemeye yarıyor.

---

## Proje Hakkında

Normalde Kubernetes kaynaklarını görmek için terminale `kubectl get pods` gibi komutlar yazmak gerekiyor. Bu proje bunun yerine bir web arayüzü sunuyor. Tarayıcıdan açıp pod listesini görebiliyorsun, istediğin pod'un loglarını canlı olarak izleyebiliyorsun.

### Neler yapılabiliyor?

- Kubernetes'teki pod'ları tablo halinde görmek (isim, durum, namespace)
- Deployment'ları görmek (isim, namespace, kaç replica çalışıyor)
- Herhangi bir pod'un loglarını canlı olarak izlemek
- Pod durumuna göre renk göstergesi (yeşil = çalışıyor, sarı = bekliyor, kırmızı = hata)

---

## Kullanılan Teknolojiler

### Backend
- **Node.js + Express** — API sunucusu. Angular'dan gelen istekleri karşılıyor ve Kubernetes'e iletiyor.
- **TypeScript** — JavaScript'in tip güvenli hali. Hataları çalıştırmadan önce yakalamak için kullandım.
- **@kubernetes/client-node** — Kubernetes'in resmi Node.js kütüphanesi. Bunu araştırdım ve en yaygın kullanılan resmi kütüphane olduğu için seçtim. kubectl'in arka planda kullandığı Kubernetes REST API'sini bizim için sarmalıyor, kubeconfig dosyasını otomatik okuyor.
- **ws** — WebSocket kütüphanesi. Canlı log akışı için kullandım.
- **cors** — Angular (port 4200) ile backend (port 3000) farklı portlarda çalıştığı için browser bunu engelliyordu, cors paketi bunu çözüyor.

### Frontend
- **Angular** — Web arayüzü için. Talya Bilişim'in kullandığı framework olduğu için tercih ettim.
- **TypeScript** — Angular zaten TypeScript ile çalışıyor.

### Altyapı
- **Kubernetes** — Pod, deployment ve log verilerinin kaynağı. Veritabanı kullanmadım çünkü tüm veriler zaten Kubernetes'te canlı olarak duruyor.
- **Minikube** — Geliştirme sırasında local Kubernetes ortamı için kullandım.

---

## Mimari

```
Angular (tarayıcı, port 4200)
    |
    |-- HTTP GET /api/pods          --> Pod listesi
    |-- HTTP GET /api/deployments   --> Deployment listesi
    |-- WebSocket ws://localhost:3000 --> Canlı log akışı
    |
Node.js + Express (port 3000)
    |
    |-- @kubernetes/client-node
    |
Kubernetes API (Minikube)
```

Angular doğrudan Kubernetes'e bağlanamıyor çünkü Kubernetes'e bağlanmak için gereken kimlik bilgileri (token, sertifika) tarayıcıya gönderilmek zorunda kalırdı ve bu büyük bir güvenlik açığı oluştururdu. Node.js bu kimlik bilgilerini sunucu tarafında saklıyor ve Angular adına Kubernetes ile konuşuyor.

Canlı loglar için WebSocket kullandım çünkü normal HTTP her istekten sonra bağlantıyı kapatıyor. WebSocket bağlantıyı açık tutuyor ve yeni log satırı geldiğinde sunucu onu anında tarayıcıya gönderiyor.

---

## Klasör Yapısı

```
k8s-dashboard/
├── backend/
│   ├── src/
│   │   ├── index.ts              → Sunucu başlangıç noktası, WebSocket da burada
│   │   ├── k8s/
│   │   │   └── client.ts         → Kubernetes bağlantısı kurulup export ediliyor
│   │   └── routes/
│   │       ├── pods.ts           → GET /api/pods endpoint'i
│   │       └── deployments.ts    → GET /api/deployments endpoint'i
│   ├── package.json
│   └── tsconfig.json
│
└── frontend/
    └── src/
        └── app/
            ├── app.ts              → Ana component, pod/log mantığı burada
            ├── app.html            → Ekranda görünen tablo ve log paneli
            ├── app.css             → Stiller
            ├── app-module.ts       → Angular modül tanımı
            └── kubernetes.service.ts → HTTP ve WebSocket çağrıları
```

---

## Kurulum ve Çalıştırma

### Gereksinimler

- Node.js (v18+)
- Docker Desktop
- Minikube
- Angular CLI (`npm install -g @angular/cli`)

### 1. Docker Desktop'ı aç

Minikube Docker üzerinde çalıştığı için önce Docker Desktop'ın açık ve çalışır durumda olması gerekiyor.

### 2. Minikube'u başlat

```bash
minikube start
```

### 3. Test için bir pod oluştur (opsiyonel)

```bash
kubectl run nginx-test --image=nginx --port=80
kubectl create deployment nginx-deployment --image=nginx
```

### 4. Backend'i başlat

```bash
cd backend
npm install
npm start
```

Terminalde `Server started on http://localhost:3000` yazısını görürsen çalışıyor demektir.

### 5. Frontend'i başlat (yeni terminal)

```bash
cd frontend
npm install
ng serve
```

### 6. Tarayıcıda aç

```
http://localhost:4200
```

---

## API Endpoints

| Method | URL | Açıklama |
|--------|-----|----------|
| GET | `/api/pods?namespace=default` | Belirtilen namespace'deki pod listesi |
| GET | `/api/deployments?namespace=default` | Belirtilen namespace'deki deployment listesi |
| WebSocket | `ws://localhost:3000?pod=<isim>&namespace=default` | Pod'un canlı log akışı |

---

## Dosya Açıklamaları

### backend/src/k8s/client.ts
Kubernetes bağlantısını kuran dosya. `@kubernetes/client-node` kütüphanesi ile `~/.kube/config` dosyasını (Minikube otomatik oluşturuyor) okuyup iki API istemcisi oluşturuyor: `CoreV1Api` pod ve servisler için, `AppsV1Api` deployment'lar için. Bu ikisini export ediyor ki diğer dosyalar tekrar bağlantı kurmak zorunda kalmasın.

### backend/src/routes/pods.ts
`GET /api/pods` endpoint'ini tanımlayan dosya. `coreV1Api.listNamespacedPod()` ile Kubernetes'e soruyor, gelen büyük objenin içinden sadece lazım olan alanları (isim, durum, namespace) alıp temiz bir JSON olarak döndürüyor. `namespace` parametresi URL'den geliyor, gelmezse varsayılan olarak `default` kullanıyor.

### backend/src/routes/deployments.ts
`GET /api/deployments` endpoint'i. Pod endpoint'i ile aynı mantık, sadece `appsV1Api.listNamespacedDeployment()` kullanıyor ve deployment'a özel alanları (replica sayısı, hazır replica sayısı) döndürüyor.

### backend/src/index.ts
Sunucunun başladığı dosya. Express kurulumu, CORS ve route bağlantıları burada. Ayrıca WebSocket sunucusu da bu dosyada. Bir WebSocket bağlantısı geldiğinde URL'den pod ismini alıyor, `k8s.Log` sınıfı ile Kubernetes'ten log akışı açıyor ve gelen her satırı WebSocket üzerinden tarayıcıya iletiyor. Bağlantı kapandığında log akışı da durduruluyor.

### frontend/src/app/kubernetes.service.ts
Angular'da HTTP ve WebSocket işlerini yürüten servis. `getPods()` ve `getDeployments()` metodları backend'e HTTP isteği atıp Observable döndürüyor. `streamLogs()` metodu WebSocket bağlantısı açıp gelen her log satırını Observable olarak yayıyor. Servislerin ayrı bir dosyada olmasının sebebi component'lerin veri çekme işiyle uğraşmaması, sadece ekrana yansıtmasıyla ilgilenmesi.

### frontend/src/app/app.ts
Ana component. Sayfa açıldığında `ngOnInit` ile pod ve deployment listelerini yükliyor. "View Logs" butonuna basıldığında `viewLogs()` metodu devreye giriyor ve WebSocket aboneliği başlatıyor. Her yeni log satırı geldiğinde diziye ekleyip `ChangeDetectorRef.detectChanges()` ile Angular'a "ekranı güncelle" diyoruz. "Close" butonuna basıldığında WebSocket aboneliği kapatılıyor.

### frontend/src/app/app.html
Ekranda görünen şablonun dosyası. `*ngFor` ile pod ve deployment dizilerini tabloya dönüştürüyor. Pod durumuna göre CSS sınıfı atıyor (running/pending/error). Log satırlarında "error" veya "warn" geçiyorsa kırmızı renk veriyor.

---

Talya Bilişim Stajı — 2026
