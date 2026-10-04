export function Metric({
  icon,
  label,
  value,
  note,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
  tone: string;
}) {
  return (
    <div className="metric-card">
      <div>
        <label>{label}</label>
        <strong>{value}</strong>
        <small className={tone === 'green' ? 'green-text' : ''}>{note}</small>
      </div>
      <div className={`metric-icon ${tone}`}>{icon}</div>
    </div>
  );
}
