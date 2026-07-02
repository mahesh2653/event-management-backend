import dotenv from "dotenv";

import { Router } from "express";
import authRoutes from "./auth.routes";
import eventRoutes from "./event.routes";
import categoryRoutes from "./category.routes";
import adminRoutes from "./admin.routes";

const routerV1 = Router();
dotenv.config();
interface IRoutes {
  path: string;
  route: Router;
}

const productionRoutes: IRoutes[] = [
  {
    path: "/auth",
    route: authRoutes,
  },
  {
    path: "/event",
    route: eventRoutes,
  },
  {
    path: "/category",
    route: categoryRoutes,
  },
  {
    path: "/admin",
    route: adminRoutes,
  },
];

productionRoutes.forEach((route) => {
  routerV1.use(route.path, route.route);
});

export default routerV1;
