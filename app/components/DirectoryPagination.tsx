export function DirectoryPagination({ page, more, url }: { page: number; more: boolean; url: (page: number) => string }) {
  if (page === 1 && !more) return null;
  return <nav className="list-pages" aria-label="Тізім беттері">
    {page > 1 && <a href={url(page - 1)}>Алдыңғы бет</a>}<span>{page}-бет</span>
    {more && <a href={url(page + 1)}>Келесі бет</a>}
  </nav>;
}
