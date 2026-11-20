import type { listBranches } from "@/db/queries";
import { statusLabel } from "@/lib/format";
import styles from "./BranchDirectory.module.css";

type Branch = Awaited<ReturnType<typeof listBranches>>[number];
export type DirectorySearch = { q?: string; sort?: string };

export function BranchDirectory({ branches, query, cabinet = false }: {
  branches: Branch[]; query: DirectorySearch; cabinet?: boolean;
}) {
  const base = cabinet ? "/dashboard/branches" : "/branches";
  const needle = query.q?.trim().toLocaleLowerCase("kk-KZ") ?? "";
  const rows = branches.filter((b) => [b.name, b.regionName, cabinet ? b.directorName : ""].join(" ").toLocaleLowerCase("kk-KZ").includes(needle));
  const sort = query.sort;
  const metric = sort === "members" ? "memberCount" : sort === "applicants" ? "applicantCount" : sort === "reserve" ? "reserveCount" : null;
  rows.sort((a, b) => (metric ? b[metric] - a[metric] : 0) || a.regionName.localeCompare(b.regionName, "kk") || a.id.localeCompare(b.id));
  return <>
    <form className={styles.filters} method="get">
      <label>{cabinet ? "Филиал, өңір немесе директор" : "Филиал немесе өңір"}<input name="q" type="search" defaultValue={query.q} maxLength={160} /></label>
      {cabinet && <label>Сұрыптау<select name="sort" defaultValue={sort || ""}>
        <option value="">Өңір атауы бойынша</option>{cabinet && <><option value="members">Мүшесі көп өңірлер</option>
        <option value="applicants">Үміткері көп өңірлер</option><option value="reserve">Резерві көп өңірлер</option></>}
      </select></label>}
      <button className="button" type="submit">Көрсету</button>{(needle || sort) && <a href={base}>Тазарту</a>}
    </form>
    {!cabinet && rows.length > 0 ? <ul className={styles.publicList}>{rows.map(b => <li key={b.id}><strong>{b.regionName}</strong><a href={"/events?period=all&region=" + encodeURIComponent(b.regionName)}>Өңірдің кездесулері →</a></li>)}</ul> : rows.length ? <table className={styles.directory}>
      <caption>{rows.length} филиал</caption>
      <thead><tr><th scope="col">Өңір</th><th scope="col">Мүше</th><th scope="col">Үміткер</th><th scope="col">Резерв</th></tr></thead>
      <tbody>{rows.map((b) => {
        const id = encodeURIComponent(b.id);
        return <tr key={b.id}><th scope="row">{cabinet ? <a href={`/dashboard/branches/${id}`}>{b.regionName}</a> : b.regionName}
          {b.name !== b.regionName && <small>{b.name}</small>}
          {b.status !== "active" && <small>{statusLabel(b.status)}</small>}
        </th>
          <td>{cabinet ? <a aria-label={b.regionName + " мүшелері"} href={`/dashboard/members?branchId=${id}`}>{b.memberCount}</a> : b.memberCount}</td>
          <td>{cabinet ? <a aria-label={b.regionName + " үміткерлері"} href={`/dashboard/applications?branchId=${id}&status=applicant`}>{b.applicantCount}</a> : b.applicantCount}</td>
          <td>{cabinet ? <a aria-label={b.regionName + " резерві"} href={`/dashboard/reports?kind=members&branchId=${id}&status=reserve`}>{b.reserveCount}</a> : b.reserveCount}</td>
        </tr>;
      })}</tbody>
    </table> : <p className="empty-content">Филиал табылмады. {needle && <a href={base}>Барлық филиалды көру</a>}</p>}
  </>;
}
