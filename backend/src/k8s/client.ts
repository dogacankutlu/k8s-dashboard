// @kubernetes/client-node paketini import ediyoruz.
// Bu paket, Kubernetes API'siyle konuşmamızı sağlayan resmi Node.js kütüphanesi.
// "* as k8s" diyerek paketteki her şeyi "k8s" ismiyle kullanabiliyoruz, mesela k8s.KubeConfig gibi.
import * as k8s from '@kubernetes/client-node';

// KubeConfig, Kubernetes'e nasıl bağlanacağımızı tutan bir yapı.
// İçinde cluster adresi, kullanıcı adı, token, sertifika gibi bilgiler var.
// new diyerek bu yapıdan bir örnek (instance) oluşturuyoruz.
const kubeConfig = new k8s.KubeConfig();

// loadFromDefault() diyerek bilgisayardaki ~/.kube/config dosyasını okuyoruz.
// Bu dosyayı minikube start komutu otomatik oluşturdu.
// Yani biz şifre ya da adres yazmak zorunda kalmıyoruz, minikube hallediyor.
kubeConfig.loadFromDefault();

// makeApiClient ile CoreV1Api adında bir istemci oluşturuyoruz.
// CoreV1Api bize pod'ları, servisleri listelemek gibi temel Kubernetes işlemlerini yapabiliyor.
// "export" diyoruz çünkü bunu başka dosyalar kullanacak (pods.ts gibi).
export const coreV1Api = kubeConfig.makeApiClient(k8s.CoreV1Api);

// AppsV1Api ise deployment'ları listelemek için kullanılan farklı bir API istemcisi.
// Kubernetes'in API'si farklı kaynak türleri için farklı API gruplarına ayrılmış,
// bu yüzden pod'lar için CoreV1Api, deployment'lar için AppsV1Api kullanıyoruz.
export const appsV1Api = kubeConfig.makeApiClient(k8s.AppsV1Api);
