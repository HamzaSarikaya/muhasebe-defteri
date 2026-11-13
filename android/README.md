# Muhasebe Android

Android 7.0 veya üzeri için, canlı Muhasebe arayüzünü uygulamanın kendi WebView penceresinde açan imzalı APK. Güncel Android System WebView ve internet bağlantısı gerekir. Chrome uygulamasını başlatmaz.

## Açılış ve kullanım

Güncel yükleme paketi APK 0.4.6'dır. Canlı web arayüzü [0.4.7](https://github.com/HamzaSarikaya/muhasebe-defteri/releases/latest) sürümündedir; mevcut APK bu güncel arayüzü açar. Yalnızca web arayüzü değiştiğinde APK sürüm numarası değişmez ve yeniden kurulum gerekmez.

Sistem logosu, gri zeminli uygulama ekranına geçer. Logo ve içerik aynı pencerededir; ilk web görüntüsü çizilince logo kalkar. Sabit bekleme süresi yoktur. Bağlantı hatasında Yeniden dene gösterilir. Geri tuşu sayfa geçmişinde ilerler; ilk sayfada uygulamayı kapatır. Klavye ve sistem çubuklarının boşlukları korunur.

0.4.3 ve önceki sürümlerin Chrome oturumu bu uygulamaya aktarılmaz. 0.4.4 kurulumundan sonra bir kez yeniden giriş gerekir; sunucudaki mali kayıtlar korunur. Sonraki açılışlar uygulamanın kendi oturum çerezlerini kullanır.

## Dosyalar ve bağlantılar

CSV ve JSON dışa aktarma Android dosya kaydetme penceresini açar. Yerel köprü yalnızca üretim HTTPS adresinin ana çerçevesine açıktır; dosya türü, adı ve boyutu doğrulanır. Dosya sistemi erişimi ve karma HTTP içerik kapalıdır. Başka sitelerin kullanıcı tarafından açılan HTTPS bağlantıları varsayılan uygulamaya yönlendirilir.

## Derleme

JDK 17+, Gradle 8.13 ve Android SDK 36 gerekir. ANDROID_HOME SDK dizinini göstermelidir. İmzalı sürüm için kendi anahtarınızla MUHASEBE_SIGNING_STORE, MUHASEBE_SIGNING_STORE_PASSWORD, MUHASEBE_SIGNING_KEY_ALIAS ve MUHASEBE_SIGNING_KEY_PASSWORD ortam değişkenlerini tanımlayın. İmza anahtarını ve parolaları depoya eklemeyin; güncellemelerde aynı anahtar gerekir.

Bu dizinde `gradle assembleRelease lintRelease` çalıştırın. APK `app/build/outputs/apk/release/app-release.apk` altında oluşur. Cihaz testleri için `gradle connectedDebugAndroidTest` kullanın. İmzayı Android SDK `apksigner verify --verbose --print-certs` komutuyla doğrulayın.
