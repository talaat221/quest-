import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NAV_GROUPS, navigationGroup, settingsSection, profileInitial } from '../src/app-navigation.js';
import { getHomePage } from '../src/home-finish.js';

test('primary navigation covers every activity and routes each link to a real page',()=>{
  const pages=['home','today-quests','quests','anchors','goals','study','farm','stats','rewards','competition','friends','profile','settings'];
  for(const page of pages)assert.equal(NAV_GROUPS.filter(group=>group.pages.includes(page)).length,1,page);
  for(const group of NAV_GROUPS){assert.equal(getHomePage('#'+group.route),group.route);for(const [page] of group.tabs)assert.equal(getHomePage('#'+page),page);}
  assert.equal(navigationGroup('settings').id,'you');
  assert.equal(navigationGroup('settings',true).id,'you');
  assert.equal(navigationGroup('profile').id,'you');
  assert.equal(navigationGroup('farm',true).id,'you');
  assert.equal(navigationGroup('anchors').id,'plan');
});
test('nested settings reloads resolve safely, and old More links reach the profile',()=>{
  for(const section of ['account','notifications','routine','sync','data']){
    assert.equal(getHomePage('#settings/'+section),'settings');
    assert.equal(settingsSection('#settings/'+section),section);
  }
  for(const hash of ['#settings','#settings/missing','#settings/__proto__'])assert.equal(settingsSection(hash),'');
  assert.equal(getHomePage('#more'),'profile');
  assert.equal(profileInitial('  talaat '),'T');assert.equal(profileInitial('أحمد'),'أ');
});
