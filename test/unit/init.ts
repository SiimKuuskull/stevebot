import sinon from 'sinon';
import { disableLogs } from '../../src/tools/logger';

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
