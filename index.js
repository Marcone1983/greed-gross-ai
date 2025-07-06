/**
 * @format
 */

import {AppRegistry} from 'react-native';
// Temporaneamente uso AppMinimal per testare
import App from './AppMinimal';
// import App from './App';
import {name as appName} from './app.json';

console.log('Registering app:', appName);
AppRegistry.registerComponent(appName, () => App);
