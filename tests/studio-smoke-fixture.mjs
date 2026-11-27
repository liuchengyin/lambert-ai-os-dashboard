// Disposable acceptance fixture; no workspace user data.
import {test} from 'node:test';
import assert from 'node:assert/strict';
export const greeting = 'Lambert Studio';
test('greeting is non-empty',()=>assert.equal(greeting, 'Lambert Studio'));
