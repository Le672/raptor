import { createReaderWorker } from '../../shared/reader-worker.mjs';
import { SOURCE, imageSource } from './service.mjs';
import { bookIdValid, sourceBookUrl } from '../shared/sources.mjs';
import * as service from './multi-source.mjs';
import { snapshotStatus } from './cache.mjs';
export default createReaderWorker({site:'ln',origin:'https://ln.yukino.bond',SOURCE,imageSource,bookIdValid,sourceBookUrl,...service,snapshotStatus});
