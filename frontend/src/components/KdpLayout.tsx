import { Outlet } from 'react-router-dom';
import KdpNav from './KdpNav';

export default function KdpLayout() {
  return (
    <div className="h-full flex flex-col">
      <KdpNav />
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
}
