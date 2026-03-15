import { createTimeAggregatorService } from '../../server/time-service';

type RequestLike = {
  method?: string;
};

type ResponseLike = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => {
    end: () => void;
    json: (payload: unknown) => void;
  };
};

const service = createTimeAggregatorService();

export default async function handler(req: RequestLike, res: ResponseLike) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  try {
    const payload = await service.getAggregate();
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(payload);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'internal_error'
    });
  }
}
