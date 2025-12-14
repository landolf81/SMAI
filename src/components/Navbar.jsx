import AgricultureIcon from "@mui/icons-material/Agriculture";
import { Link } from "react-router-dom";

const Navbar = () => {
  return (
    <div className="bg-white shadow-sm border-b">
      <div className="max-w-md mx-auto p-4">
        <div className="flex items-center justify-center">
          <Link to="/" className="flex items-center text-xl font-bold text-[#004225]">
            <AgricultureIcon className="mr-2" />
            성주참외 경락정보
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Navbar;