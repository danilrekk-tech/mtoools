
Задача большая — ниже поэтапный план. Все правки затрагивают frontend и backend (миграции, серверные функции TanStack Start, публичный webhook, коннектор Telegram).

## 1. База данных (миграция)

- `audit_logs`: `actor_id`, `action`, `entity_type`, `entity_id`, `changes jsonb`, `created_at`. RLS: читают admin/manager, пишут через SECURITY DEFINER `log_audit(...)`.
- `telegram_messages`: журнал входящих апдейтов (`update_id` PK, `chat_id`, `user_id`, `text`, `raw_update`).
- `notifications`: `user_id`, `channel` (email/telegram/inapp), `title`, `body`, `read_at`, `meta jsonb`.
- Триггеры аудита на `user_roles`, `profiles.department_id`, `department_tools`, `user_tool_overrides`, `shifts`, `tools`.
- Триггер `shifts_after_change` → пишет в `notifications` для сотрудника при вставке/обновлении/удалении смены.
- Триггер `department_tools_after_insert` / `user_tool_overrides_after_insert` → уведомление о новом инструменте.
- Объединение "инструментов и сервисов": в `tools` уже есть `kind ('internal'|'external')` и `url`. Мигрируем существующие строки из `services` в `tools` (kind='external'), затем удаляем таблицу `services` и соответствующие роуты.

## 2. Telegram: webhook + адресная отправка

- Подключить коннектор Telegram (`standard_connectors--connect`) — HITL-карточка пользователю.
- `src/routes/api/public/telegram/webhook.ts` — приём апдейтов с проверкой `X-Telegram-Bot-Api-Secret-Token` (SHA256 от `TELEGRAM_API_KEY`). Команды:
  - `/start`, `/help` — общая справка.
  - `/link CODE` — привязка `telegram_chat_id`/`telegram_username` к профилю по `telegram_link_code`.
  - `/tasks` — задачи сотрудника (у всех).
  - `/shift` — ближайшая смена (у всех).
  - `/team` (manager/admin) — задачи отдела.
  - Отделозависимые: `/leads` (Продажи), `/tickets` (Поддержка), `/campaigns` (Маркетинг), `/deploys` (Разработка), `/briefs` (Дизайн) — заглушки, отдающие релевантные данные из БД либо статус "скоро".
- `sendTelegram.functions.ts` (server fn, admin/manager only): отправляет сообщение конкретному `user_id` через gateway `sendMessage`, читая `telegram_chat_id` из `profiles`.
- Регистрация webhook — команда из sandbox `curl` после привязки коннектора.

## 3. Уведомления

- Сервис-функция `notify(user_id, {title, body, channels})`:
  - Всегда пишет в `notifications` (inapp badge в топбаре).
  - Если `telegram` и есть `chat_id` — шлёт через gateway.
  - Если `email` — через Resend/встроенный email (Lovable email) — Lovable transactional email.
- Вызывается из триггеров БД через `pg_net` в TanStack route `/api/public/notify` (HMAC-подписанный). Проще: делаем всё в SQL-триггере записью в `notifications`, а рассылка Telegram/email — фоновым polling'ом cron через TanStack route `/api/public/cron/dispatch-notifications` (планировщик Lovable Cron).

## 4. Планировщик смен (визуальный)

- `src/routes/_authenticated/admin/shifts.tsx` заменить на недельную сетку:
  - Слева — сотрудники, сверху — 7 дней недели, кнопки навигации prev/next.
  - Клик по ячейке — диалог создания/редактирования смены (время, цвет, заголовок).
  - Drag/resize опустим для скорости — только клик+диалог + удаление.
- Для сотрудников — вью "моя занятость" на `/calendar` остаётся, но исправлена (см. п.7).

## 5. Логотип

- Заменить `<Logo>` на текстовый: крупный градиентный "M​tools" через `gradient-brand bg-clip-text text-transparent`, размер увеличить в сайдбаре и лендинге. PNG-ассет больше не используется в шапке.

## 6. Объединение Инструменты + Сервисы

- Удалить страницу `/services` и админку сервисов; в сайдбаре убрать пункт.
- На дашборде блок "Мои инструменты" показывает всё, что пользователь выбрал (layout='dashboard') из `tools` (внутренние и внешние).
- В `/tools` карточки одинаковые, для external — кнопка "Открыть в новой вкладке".
- Данные `services` мигрировать в `tools` (kind='external').

## 7. Календарь

- Диагностировать: скорее всего `shiftsQuery` фильтрует только по `user_id=me` для рядового сотрудника, а modifiers дергают `.toDateString()` на UTC. Нужно:
  - Показывать все смены пользователя (свои — сотруднику, всех — менеджеру/админу).
  - Нормализовать даты в локальную TZ, использовать `date.toDateString()` последовательно.
  - Отрисовывать точки на днях с сменами.

## 8. Адресная отправка сообщений

- В `/admin/users` рядом с каждым сотрудником — кнопка "Написать в Telegram" → диалог с текстом → вызов `sendTelegram` server fn.
- В `/admin/telegram` — вкладка "Рассылка": по отделу или всем.

## 9. Мобильная адаптация

- Все страницы: заголовки и подписи переносим на `text-xl sm:text-2xl`, сетки `grid-cols-1 md:grid-cols-2`, кнопки-иконки на md+.
- Таблицы (`/admin/users`, планировщик смен): на мобиле показываем карточным списком (`hidden md:table` + `md:hidden` карточки), горизонтальный скролл только если совсем необходимо.
- Сайдбар уже адаптивный через shadcn `SidebarProvider` — проверить, что топбар открывает `SidebarTrigger` на мобиле.
- Заголовки строк с иконкой + текстом — обернуть в `grid-cols-[minmax(0,1fr)_auto]` (см. responsive-layout-patterns).

## 10. Аудит-лог UI

- Новая страница `/admin/audit` — таблица последних действий (actor, action, entity, diff), фильтры по типу/дате, пагинация 50.

---

### Технические детали

- Все server fn — под `.middleware([requireSupabaseAuth])`, привилегированные операции — через `has_role` проверку и последующий `supabaseAdmin` внутри handler'а.
- Webhook Telegram — `/api/public/telegram/webhook`, публичный, авторизация — секрет-заголовок.
- Уведомления по расписанию — cron задача Lovable, `/api/public/cron/dispatch-notifications` с HMAC.
- Миграция удаляет таблицу `services` после копирования данных; правим `src/lib/queries.ts`, `app-sidebar.tsx`, роуты.
- `routeTree.gen.ts` регенерируется автоматически.

Объём большой; запускаю по порядку: миграция → бэкенд/webhook → фронт-страницы → мобильная адаптация → верификация билда.
