import PropTypes from "prop-types";

const AiRephraseButton = ({ children, disabled, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full border border-white/50 bg-[linear-gradient(110deg,#6d28d9,#db2777,#2563eb,#6d28d9)] bg-[length:220%_100%] px-4 py-2 text-xs font-bold text-white shadow-[0_0_18px_rgba(124,58,237,0.38),0_8px_18px_rgba(37,99,235,0.18)] transition hover:-translate-y-0.5 hover:bg-[position:100%_0] hover:shadow-[0_0_34px_rgba(217,70,239,0.58),0_10px_24px_rgba(37,99,235,0.26)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
    >
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.42),transparent_28%),radial-gradient(circle_at_80%_30%,rgba(255,255,255,0.28),transparent_24%)] opacity-70" />
      <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/45 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      <span className="relative flex h-5 w-5 items-center justify-center rounded-full bg-white/25 text-[13px] shadow-inner shadow-white/20">
        AI
      </span>
      <span className="relative">{children}</span>
      <span className="relative text-sm leading-none drop-shadow-[0_0_8px_rgba(255,255,255,0.9)]">✦</span>
    </button>
  );
};

AiRephraseButton.propTypes = {
  children: PropTypes.node.isRequired,
  disabled: PropTypes.bool,
  onClick: PropTypes.func.isRequired,
};

export default AiRephraseButton;
