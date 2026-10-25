export default function CsvTable({ columns, rows, offset = 0, types = {} }) {
  return (
    <div className="csv-table-scroll" tabIndex={0} aria-label="CSV rows">
      <table className="analytics-table csv-table">
        <thead><tr><th scope="col">#</th>{columns.map((column, i) => <th scope="col" key={`${column}-${i}`}>
          {column}{types[column] && <small>{types[column]}</small>}
        </th>)}</tr></thead>
        <tbody>{rows.map((row, i) => <tr key={offset + i}>
          <th scope="row">{(offset + i + 1).toLocaleString()}</th>
          {columns.map((column, j) => {
            const value = Array.isArray(row) ? row[j] : row[column];
            return <td key={j}>{value == null ? <span className="csv-null">—</span> : String(value)}</td>;
          })}
        </tr>)}</tbody>
      </table>
      {!rows.length && <p className="csv-empty">No rows found.</p>}
    </div>
  );
}
