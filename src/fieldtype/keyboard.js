function validateModType (mod) {
  if (
    (
      typeof mod === 'string'
      || (Array.isArray(mod) && mod.every(m => typeof m === 'string'))
    )
    === false
  ) {
    throw new Error('Wrong parameter-type for \'mod\'. must be string or array of strings.')
  }
}

function validateKeyType (key) {
  if (
    (
      typeof key === 'string'
      || (Array.isArray(key) && key.every(k => typeof k === 'string'))
    )
    === false
  ) {
    throw new Error('Wrong parameter-type for \'key\'. must be string or array of strings.')
  }
}

function normalizeModifiers (mod) {
  if (typeof mod === 'string') {
    return normalizeModifiersExecute(mod)
  } else {
    return mod.map(m => normalizeModifiersExecute(m))
  }
}

function normalizeModifiersExecute (mod) {
  mod = mod.toLocaleLowerCase()
  mod = mod[0].toLocaleUpperCase().concat(mod.substr(1))
  switch (mod) {
    case 'Ctrl':
      mod = 'Control'
      break
  }
  return mod
}

function normalizeKeys (key, caseSensitive) {
  const keys = Array.isArray(key) ? key : [key]

  return keys.map(key => {
    if (key.length > 1) {
      key = key[0].toLocaleUpperCase().concat(key.substr(1))
      switch (key) {
        case 'Esc':
          key = 'Escape'
          break
        case 'Del':
          key = 'Delete'
          break
        case 'Space':
        case 'Spacebar':
          key = ' '
          break
        case 'Ctrl':
          key = 'Control'
      }
    } else {
      if (!caseSensitive) {
        key = key.toLocaleLowerCase()
      }
    }
    return key
  })
}

function additionalModifierHit (event, mod) {
  const modifierList = MODIFIER_LIST.slice(0)
  if (typeof mod === 'string') {
    modifierList.splice(modifierList.indexOf(mod), 1)
  } else {
    mod.forEach(m => modifierList.splice(modifierList.indexOf(m), 1))
  }

  const endIndex = modifierList.length - 1
  for (let i = endIndex; i >= 0; i--) {
    if (event.getModifierState(modifierList[i])) {
      return true
    }
  }

  return false
}

function modifierHit (event, mod, sole) {
  mod = normalizeModifiers(mod)

  if (sole) {
    if (additionalModifierHit(event, mod)) {
      return false
    } else {
      return checkModifier(event, mod)
    }
  }

  return checkModifier(event, mod)
}

function checkModifier (event, mod) {
  if (typeof mod === 'string') {
    return Boolean(event.getModifierState(mod))
  } else {
    return mod.every(m => event.getModifierState(m))
  }
}

function keyHit (event, key, caseSensitive) {
  key = normalizeKeys(key)
  if (!caseSensitive) {
    return typeof key === 'string'
      ? event.key.toLocaleLowerCase() === key.toLocaleLowerCase()
      : key.some(k => k.toLocaleLowerCase() === event.key.toLocaleLowerCase())
  } else {
    return typeof key === 'string'
      ? event.key === key
      : key.some(k => k === event.key)
  }
}

export const MODIFIER_LIST = [
  'Alt', 'AltGraph', 'Control', 'Fn', 'Hyper', 'Meta', 'Shift', 'Super',
]

/**
 * Default behavoiur: Exactly match the keystroke given. Don't allow additional modifiers or keys to be active.
 * Notice: Only jquery events are supported at this moment.
 * @param shortcuts:
 * { mod: "Control", key: "Z" }
 * { mod: "Control", key: ["X", "Y", "Z"] }
 * { mod: ["Control", "Shift"], key: ["X", "Y", "Z"] }
 * isShortcutHit(event, { mod: "Control", key: ["X", "Y", "Z"] }, { mod: "Alt", key: "R" })
 */
export function isShortcutHit (event, shortcut) {
  let shortcuts = Array.isArray(shortcut)
    ? shortcut
    : [shortcut]
  // check for type errors
  shortcuts.forEach(shortcut => validateModType(shortcut.mod))
  shortcuts.forEach(shortcut => validateKeyType(shortcut.key))
  // normalize modifiers
  shortcuts = shortcuts.map(shortcut => {
    shortcut.mod = normalizeModifiers(shortcut.mod)
    return shortcut
  })
  return shortcuts.some(shortcut => {
    return modifierHit(event, shortcut.mod, true) && keyHit(event, shortcut.key, false)
  })
}

export function isModifierHit (event, mod, options = {
  sole: false,
}) {
  const { sole } = options
  validateModType(mod)
  return modifierHit(event, mod, sole)
}

export function isModifierNotHit (event, mod, options) {
  return !isModifierHit(event, mod, options)
}

export function isAModifierHit (event) {
  return MODIFIER_LIST.some(m => event.getModifierState(m) === true)
}

export function isNoModifierHit (event) {
  return !isAModifierHit(event)
}

export function isKeyHit (event, key, options = {
  caseSensitive: true,
}) {
  const { caseSensitive } = options
  validateKeyType(key)
  return keyHit(event, key, caseSensitive)
}
