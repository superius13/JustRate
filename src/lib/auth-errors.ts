/** Turns Supabase auth and database errors into short Russian messages for the user. */
export function describeAuthError(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
  if (typeof code === 'string') {
    switch (code) {
      case 'invalid_credentials':
        return 'Неверная почта или пароль.';
      case 'user_already_exists':
      case 'email_exists':
        return 'Аккаунт с этой почтой уже есть. Попробуй войти.';
      case 'weak_password':
        return 'Пароль слишком простой. Нужно хотя бы 6 символов.';
      case 'email_address_invalid':
      case 'validation_failed':
        return 'Проверь адрес почты.';
      case 'over_request_rate_limit':
      case 'over_email_send_rate_limit':
        return 'Слишком много попыток. Подожди немного и попробуй снова.';
      case 'email_not_confirmed':
        return 'Почта не подтверждена. В настройках Supabase нужно выключить подтверждение почты.';
      // Unknown column: the database is missing a newer file from supabase/migrations.
      case '42703':
      case 'PGRST204':
        return 'В базе не хватает новых полей. Нужно выполнить в Supabase свежий файл из supabase/migrations.';
    }
  }
  if (error instanceof Error && /network|fetch/i.test(error.message)) {
    return 'Нет связи с сервером. Проверь интернет.';
  }
  return 'Что-то пошло не так. Попробуй ещё раз.';
}
