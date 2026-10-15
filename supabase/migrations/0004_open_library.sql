-- JustRate: books found through Open Library, the fallback when Google Books is down.

alter type public.title_source add value if not exists 'open_library';
