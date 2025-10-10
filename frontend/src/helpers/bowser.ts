import Bowser from 'bowser'

const parser = Bowser.getParser(window.navigator.userAgent)

export const isAndroid = () => parser.getOSName(true) === 'android'
export const isIOS = () => parser.getOSName(true) === 'ios'
export const isIOSOrAndroid = () => isAndroid() || isIOS()
export const isPhone = () => parser.getPlatformType(true) === 'mobile'
export const isTablet = () => parser.getPlatformType(true) === 'tablet'
export const isMobile = () => isPhone() || isTablet()
export const isDesktop = () => parser.getPlatformType(true) === 'desktop'
export const isSafari = () => parser.getBrowserName(true) === 'safari'
export const isSafariOnIOS = () => isSafari() && isIOS()
export const isMac = () => parser.getOSName(true) === 'macos'
