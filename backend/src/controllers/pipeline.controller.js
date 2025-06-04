import { generateConfig, runVector } from '../services/vector.service.js';

/**
 * POST /api/pipeline
 * body: { "mode":"push_syslog" } OR { "mode":"pull_s3","bucket":"raw","region":"ap-southeast-2" }
 */
export async function createPipeline(req, res) {
  try {
    generateConfig(req.body);
    const cid = runVector();
    res.json({ status: 'started', container: cid });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e.message });
  }
}
