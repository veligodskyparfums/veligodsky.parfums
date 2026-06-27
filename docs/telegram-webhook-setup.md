# Telegram webhook -> AI drafts

Этот этап только создает безопасные AI-черновики из новых Telegram-постов.

Что уже делает webhook:

- принимает `POST` на `/api/telegram/webhook`
- проверяет `TELEGRAM_WEBHOOK_SECRET`
- создает отдельный AI-черновик
- не публикует товар автоматически
- не меняет `products[]`
- не трогает каталог, корзину и checkout

## 1. Подготовьте переменные окружения

Локально в `.env`:

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
```

В production добавьте те же переменные в окружение приложения.

## 2. Какой URL использовать

Webhook endpoint:

```text
https://YOUR-DOMAIN/api/telegram/webhook
```

## 3. Установите webhook в Telegram

Подставьте свои значения:

```text
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://YOUR-DOMAIN/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
```

Пример через браузер или `curl`:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://YOUR-DOMAIN/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

## 4. Проверка webhook

```text
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo
```

## 5. Что попадет в AI-черновик

Из нового Telegram-поста сохраняется:

- `source = "telegram"`
- `rawText` = текст поста или caption
- `status = "pending"`
- `confidenceScore = 0`
- `sourceUrl` = ссылка на пост, если у канала есть `username`
- `analysis.telegram.*` = технические данные update
- `analysis.telegram.photo.fileId` = `file_id` фото, если фото есть

## 6. Где смотреть результат

В админке в разделе `AI Черновики`.

На этом этапе:

- нет OpenAI-анализа
- нет генерации фото
- нет автопубликации

Сначала мы безопасно собираем входящие посты как черновики.

## 7. Подготовка к следующему этапу AI-генерации фото

В проекте уже зафиксировано требование для будущей AI-генерации:

- фон товара должен быть `black`
- базовый цвет фона: `#050505`
- подача: `luxury perfume product photo`

То есть на следующем этапе OpenAI будет генерировать парфюм не на белом, а на черном фоне по умолчанию.
