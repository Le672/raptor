import * as light from '../shared/sources.mjs';
import * as fiction from '../../fiction/shared/sources.mjs';
import {readerSite} from './reader-site.mjs';
const registry=readerSite.light?light:fiction;
export const {SOURCES,sourceInfo,bookIdValid,bookSource,nativeBookId,sourceBookUrl,partIdValid}=registry;
