export function PageHeader({ title, subtitle, extra }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="m-0 text-xl font-semibold text-slate-800 md:text-2xl">{title}</h1>
        {subtitle ? <p className="mt-1 mb-0 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {extra ? <div className="flex flex-wrap items-center gap-2">{extra}</div> : null}
    </div>
  );
}
