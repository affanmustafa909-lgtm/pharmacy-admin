export function ParallelPage() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Parallel</h1>
          <p className="sub">This section sits directly after Pharmacies. No records are saved here yet.</p>
        </div>
      </div>
      <article className="card">
        <h2>Waiting for the business rules</h2>
        <p className="sub">
          Parallel is in the navigation, but its purpose, required fields, and how it should behave are not assumed.
        </p>
        <p className="sub mt">
          BFP is also paused. Delivery and service charges already support fixed amounts or percentages with an explicit
          calculation base. Confirm what BFP means and how it should be calculated before any BFP rule is turned on.
        </p>
      </article>
    </>
  )
}
