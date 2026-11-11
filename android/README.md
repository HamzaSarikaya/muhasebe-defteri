# Muhasebe Android

Canlı Muhasebe çalışma alanını Google Android Browser Helper üzerinden açan, imzalı APK projesi. Android 7.0 veya üzeri ve güncel bir Trusted Web Activity destekli tarayıcı gerekir. Kayıt işlemleri internet bağlantısı kullanır. Tarayıcı altyapısı oturumu, erişilebilirliği, dosya indirmelerini ve geri gezinmeyi yönetir.

## Açılış ekranı

Soğuk açılışta Android'in sistem ekranından gri zemindeki Muhasebe logosuna geçilir. Aynı görsel, tarayıcı hazırlanırken ve ilk sayfa yüklenirken gösterilir; içerik hazır olduğunda kalkar. Sabit bir bekleme süresi veya ilerleme yüzdesi eklenmez. Özel animasyon yoktur; Android'in sistem hareket tercihleri korunur.

Ekran, AndroidX SplashScreen ve Android Browser Helper'ın splash desteğini kullanır. FileProvider yalnızca `twa_splash/` altındaki açılış görselini tarayıcıyla paylaşır.

## Derleme

JDK 17 veya üzeri, Gradle 8.13 ve Android SDK 36 gerekir. `ANDROID_HOME` SDK dizinini göstermelidir.

İmzalı sürüm için şu ortam değişkenlerini kendi imza anahtarınızla tanımlayın:

- `MUHASEBE_SIGNING_STORE`: keystore dosyası
- `MUHASEBE_SIGNING_STORE_PASSWORD`
- `MUHASEBE_SIGNING_KEY_ALIAS`
- `MUHASEBE_SIGNING_KEY_PASSWORD`

Bu dizinde `gradle assembleRelease lintRelease` çalıştırın. APK `app/build/outputs/apk/release/app-release.apk` altında oluşur. İmza anahtarını ve parolaları kaynak koduna eklemeyin; ileride aynı uygulamayı güncellemek için aynı anahtar gereklidir.

## Site doğrulaması

Tam ekran açılış için üretim sitesinin `/.well-known/assetlinks.json` dosyası bu paketin (`app.muhasebedefteri.android`) imza sertifikasını doğrulamalıdır. İmza değişirse dosyayı yeni SHA-256 sertifika parmak iziyle güncelleyin. Doğrulama olmadan tarayıcı adres çubuğu görünür.

## Kontrol

Bir Android cihazı veya emülatör bağlıyken `gradle connectedDebugAndroidTest` güvenilen adres sınırını denetler. APK imzasını Android SDK `apksigner verify --verbose --print-certs` komutuyla ayrıca doğrulayın.

Altyapı: [Android Browser Helper](https://github.com/GoogleChrome/android-browser-helper), Apache 2.0.
