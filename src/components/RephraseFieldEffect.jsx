import PropTypes from "prop-types";

const particlePositions = [
  "left-[12%] top-[52%]",
  "left-[24%] top-[44%]",
  "left-[38%] top-[58%]",
  "left-[52%] top-[46%]",
  "left-[66%] top-[56%]",
  "left-[80%] top-[48%]",
];

const RephraseFieldEffect = ({ active, children }) => {
  return (
    <div className={`relative rounded-lg ${active ? "ai-rephrase-text-active" : ""}`}>
      {children}
      {active && (
        <div className="pointer-events-none absolute inset-x-3 top-1/2 h-10 -translate-y-1/2 overflow-hidden rounded-md">
          <div className="ai-rephrase-text-scan absolute inset-y-1 w-1/4 bg-gradient-to-r from-transparent via-violet-300/35 to-transparent" />
          {particlePositions.map((position, index) => (
            <span
              key={position}
              className={`ai-rephrase-particle absolute h-1.5 w-1.5 rounded-full bg-fuchsia-300 shadow-[0_0_12px_rgba(217,70,239,0.9)] ${position}`}
              style={{ animationDelay: `${index * 70}ms` }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

RephraseFieldEffect.propTypes = {
  active: PropTypes.bool,
  children: PropTypes.node.isRequired,
};

export default RephraseFieldEffect;
