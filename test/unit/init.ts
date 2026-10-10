import sinon from 'sinon';
import { disableLogs } from '../../src/tools/logger.ts';

disableLogs();
export let sandbox;

beforeEach(function () {
    sandbox = sinon.createSandbox();
});

afterEach(function () {
    sandbox.restore();
});

before(() => {
    //
});

after(() => {
    //
});
