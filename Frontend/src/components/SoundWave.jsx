export default function SoundWave({ active = false, color = "orange", barCount = 5, size = "md" }) {
  const bars = Array.from({ length: barCount }, (_, i) => i);

  return (
    <div className={`soundwave-container ${active ? "active" : "idle"} ${color} size-${size}`}>
      {bars.map((index) => (
        <span
          key={index}
          className="soundwave-bar"
          style={{
            animationDelay: `${index * 0.12}s`,
          }}
        />
      ))}
    </div>
  );
}
