const StatCard = ({ title, value, color = "bg-indigo-600", onClick }) => {
    return (
      <div
        className={`rounded-2xl bg-white shadow p-5 ${onClick ? "cursor-pointer hover:shadow-md transition" : ""}`}
        onClick={onClick}
      >
        <p className="text-sm text-gray-500">{title}</p>
        <p className={`mt-2 text-3xl font-bold ${color.replace("bg", "text")}`}>
          {value}
        </p>
      </div>
    );
  };
  
  export default StatCard;
