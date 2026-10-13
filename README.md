# JustRate

Мобильное приложение для Android и iOS на React Native + Expo (TypeScript, Expo Router).

## Запуск на своём телефоне

1. Установи [Node.js LTS](https://nodejs.org/) и приложение **Expo Go** на телефон (App Store / Google Play).
2. В папке проекта:

   ```bash
   npm install
   npx expo start
   ```

3. Отсканируй QR-код из терминала: на Android через Expo Go, на iPhone через камеру.

## Проверки

```bash
npx expo lint      # линтер
npx tsc --noEmit   # проверка типов
```

## Структура

- `src/app/` — экраны (каждый файл = маршрут Expo Router)
- `src/components/`, `src/hooks/`, `src/constants/` — общий код
- `assets/` — иконки, шрифты, картинки

Сборка iOS идёт в облаке через EAS Build и TestFlight, Mac не нужен.
