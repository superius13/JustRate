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

- `src/app/` — экраны (каждый файл = маршрут Expo Router). Пока: вход (`sign-in`), ввод имени (`profile-setup`), главный (`index`).
- `src/components/ui/` — компоненты gluestack-ui (кнопки, поля, текст). Создаются командой `npx gluestack-ui@3 add <имя>`, руками не правим.
- `src/components/` — свои общие компоненты.
- `src/lib/` — работа с базой (`supabase.ts`), вход и профиль (`auth.tsx`).
- `supabase/migrations/` — структура базы данных. Каждый файл выполняется один раз в Supabase, по порядку.
- `assets/` — иконки и картинки.

Стиль: светлая тема «Книжная полка». Шрифты Lora (заголовки) и Golos Text (текст), основной цвет `#0F6B5C`.
Цвета задаются в `src/components/ui/gluestack-ui-provider/config.ts`, шрифты в `tailwind.config.js`.

## База данных (Supabase)

1. Создать проект на [supabase.com](https://supabase.com).
2. **SQL Editor → New query**: вставить `supabase/migrations/0001_init.sql`, нажать **Run**.
3. **Authentication → Sign In / Providers → Email**: выключить **Confirm email**.
4. Вписать в `.env` адрес проекта и publishable key из **Project Settings → API Keys**.

Сборка iOS идёт в облаке через EAS Build и TestFlight, Mac не нужен.
