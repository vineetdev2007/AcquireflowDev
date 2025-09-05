import { Router } from 'express';
import { getLoanProducts, getFinanceAssumptions } from '../controllers/financeController';

const router = Router();

router.get('/products', getLoanProducts);
router.get('/assumptions', getFinanceAssumptions);

export default router;


