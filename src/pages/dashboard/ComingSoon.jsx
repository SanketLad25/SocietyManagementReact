import Icon from '../../components/Icon.jsx'

export default function ComingSoon({ title, description, icon }) {
  return (
    <div className="dash-coming-soon">
      <span className="dash-coming-soon-icon">
        <Icon paths={icon} size={28} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      <span className="dash-coming-soon-badge">Coming soon</span>
    </div>
  )
}
