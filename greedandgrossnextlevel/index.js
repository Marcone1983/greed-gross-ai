/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import 'react-native-gesture-handler';

// Initialize i18n
import './App'; // This imports i18n configuration

AppRegistry.registerComponent(appName, () => App);