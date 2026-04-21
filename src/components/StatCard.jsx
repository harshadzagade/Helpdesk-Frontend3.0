const StatCard = ({ title, value, color = "bg-indigo-600" }) => {
    return (
      <div className="rounded-2xl bg-white shadow p-5">
        <p className="text-sm text-gray-500">{title}</p>
        <p className={`mt-2 text-3xl font-bold ${color.replace("bg", "text")}`}>
          {value}
        </p>
      </div>
    );
  };
  
  export default StatCard;
  