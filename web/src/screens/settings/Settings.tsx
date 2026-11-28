import { useViewport } from '../../shell/useViewport'
import SettingsComputer from './SettingsComputer'
import SettingsHome from './SettingsHome'

// The Settings route entry: the computer keeps its list of groups, the phone gets the home.
export default function Settings() {
  return useViewport() === 'computer' ? <SettingsComputer /> : <SettingsHome />
}
