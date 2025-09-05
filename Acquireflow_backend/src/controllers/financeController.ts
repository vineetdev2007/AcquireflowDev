import { Request, Response } from 'express';
import { financeService } from '../services/financeService';

export const getLoanProducts = async (_req: Request, res: Response) => {
  const data = await financeService.getProducts();
  res.json({ success: true, data });
};

export const getFinanceAssumptions = async (req: Request, res: Response) => {
  const userId = (req as any).user?.id as string | undefined;
  const data = await financeService.getAssumptions(userId);
  res.json({ success: true, data });
};

export default { getLoanProducts, getFinanceAssumptions };


