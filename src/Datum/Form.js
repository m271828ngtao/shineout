import shallowEqual from '../utils/shallowEqual'
import isObject from '../utils/validate/isObject'
import { flatten, unflatten } from '../utils/objects'
import { promiseAll, FormError } from '../utils/errors'
import {
  updateSubscribe, errorSubscribe, changeSubscribe,
  VALIDATE_TOPIC, RESET_TOPIC, CHANGE_TOPIC, FORCE_PASS, ERROR_TYPE,
} from './types'

const { hasOwnProperty } = Object.prototype

const getSthByName = (name, source = {}) => {
  let result = source[name]
  if (result) return result

  result = unflatten(source)
  name.split('.').forEach((n) => {
    if (result) result = result[n]
    else result = undefined
  })

  return result
}

const removeSthByName = (name, source) => {
  Object.keys(source).forEach((n) => {
    if (n === name || n.indexOf(`${name}.`) === 0) {
      delete source[n]
    }
  })
}

export default class {
  constructor(options = {}) {
    const {
      removeUndefined = true, rules, onChange, value, trim, error,
    } = options
    this.values = {}
    this.rules = rules
    this.onChange = onChange
    this.removeUndefined = removeUndefined
    this.trimValue = trim

    // store raw form values
    this.$values = {}
    // store default value, for reset
    this.$defaultValues = {}
    this.$validator = {}
    this.$events = {}
    // handle global errors
    this.$errors = {}

    if (value) this.setValue(value)
    if (error) this.setError(error)
  }

  handleChange() {
    if (this.onChange) this.onChange(this.getValue())
  }

  reset() {
    this.dispatch(RESET_TOPIC)
    this.setValue(this.$defaultValues, FORCE_PASS)
  }

  get(name) {
    return getSthByName(name, this.$values)
  }

  set(name, value, skipArray = true) {
    const flatValue = flatten(isObject(name) ? name : { [name]: value }, skipArray)
    Object.keys(flatValue).forEach((n) => {
      const newValue = flatValue[n]
      if (Array.isArray(newValue) && newValue.length > 0) this.forceSet(n, newValue, false)
      else this.$values[n] = flatValue[n]
    })

    this.throughValue('', unflatten(flatValue))
    this.dispatch(CHANGE_TOPIC)
    this.handleChange()
  }

  remove(name) {
    removeSthByName(name, this.$values)
  }

  forceSet(name, value, skipArray = false) {
    this.remove(name)
    this.set(name, value, skipArray)
  }

  getError(name) {
    return getSthByName(name, this.$errors)
  }

  setError(name, errors) {
    const flatErrors = flatten(isObject(name) ? name : { [name]: errors })
    Object.keys(flatErrors).forEach((n) => {
      this.$errors[n] = flatErrors[n]
    })

    this.throughError('', unflatten(flatErrors))
  }

  removeError(name) {
    removeSthByName(name, this.$errors)
  }

  getRule(name) {
    if (!this.rules) return []
    return this.rules[name] || []
  }

  getValue() {
    if (this.removeUndefined || this.trimValue) {
      Object.keys(this.$values).forEach((k) => {
        if (this.removeUndefined && this.$values[k] === undefined) {
          delete this.$values[k]
        }

        if (this.trimValue && typeof this.$values[k] === 'string') {
          this.$values[k] = this.$values[k].trim()
        }
      })
    }
    return unflatten(this.$values)
  }

  setValue(rawValue = {}, forcePass) {
    const values = flatten(rawValue)

    // values not change
    if (shallowEqual(values, this.$values)) return

    // clear old values
    this.$values = {}

    Object.keys(values).forEach((name) => {
      this.$values[name] = values[name]
    })

    Object.keys(this.values).forEach((name) => {
      this.dispatch(updateSubscribe(name), this.get(name), forcePass || name)
      this.dispatch(changeSubscribe(name))
    })

    this.dispatch(CHANGE_TOPIC)
  }

  throughValue(path, value) {
    if (isObject(value)) {
      Object.keys(value).forEach((name) => {
        const newName = `${path}${path ? '.' : ''}${name}`
        if (hasOwnProperty.call(this.values, newName)) {
          this.dispatch(updateSubscribe(newName), this.get(newName), newName)
          this.dispatch(changeSubscribe(newName))
        } else {
          this.throughValue(newName, value[name])
        }
      })
    }
  }

  throughError(path, error) {
    if (isObject(error)) {
      Object.keys(error).forEach((name) => {
        const newName = `${path}${path ? '.' : ''}${name}`
        if (hasOwnProperty.call(this.values, newName)) {
          this.dispatch(errorSubscribe(newName), this.getError(newName), ERROR_TYPE)
        } else {
          this.throughError(newName, error[name])
        }
      })
    }
  }


  bind(name, fn, value, validate) {
    if (hasOwnProperty.call(this.values, name)) {
      console.error(`There is already an item with name "${name}" exists. The name props must be unique.`)
    }

    this.$defaultValues[name] = value
    this.$validator[name] = validate

    this.values[name] = true

    if (value !== undefined && !this.get(name)) {
      const flatValue = flatten({ [name]: value })
      Object.keys(flatValue).forEach((n) => { this.$values[n] = flatValue[n] })

      this.dispatch(changeSubscribe(name))
      this.dispatch(CHANGE_TOPIC)
    }

    this.subscribe(updateSubscribe(name), fn)
    this.subscribe(errorSubscribe(name), fn)
  }

  unbind(name) {
    if (Array.isArray(name)) {
      name.forEach(n => this.unbind(n))
      return
    }

    delete this.$values[name]
    delete this.values[name]
    delete this.$validator[name]
    this.unsubscribe(updateSubscribe(name))
    name += '.'
    Object.keys(this.$values).forEach((key) => {
      if (key.indexOf(name) === 0) delete this.$values[key]
    })
  }

  dispatch(name, ...args) {
    const event = this.$events[name]
    if (!event) return
    event.forEach(fn => fn(...args))
  }

  subscribe(name, fn) {
    if (!this.$events[name]) this.$events[name] = []
    const events = this.$events[name]
    if (fn in events) return
    events.push(fn)
  }

  unsubscribe(name, fn) {
    if (!this.$events[name]) return
    this.$events[name] = this.$events[name].filter(e => e !== fn)
  }

  validate(changeState = false) {
    return new Promise((resolve, reject) => {
      const keys = Object.keys(this.$validator)
      const values = { ...this.$values }

      const validates = [
        ...keys.map(k => this.$validator[k](this.get(k), values, !changeState)),
        ...(this.$events[VALIDATE_TOPIC] || []).map(fn => fn()),
      ]

      Promise.all(validates).then((res) => {
        const error = res.find(r => r !== true)
        if (error === undefined) resolve(true)
        else reject(error)
      }).catch((e) => {
        reject(new FormError(e))
      })
    })
  }

  validateFields(names) {
    if (!Array.isArray(names)) names = [names]
    const values = { ...this.$values }
    const validates = []
    names.forEach((k) => {
      if (this.$validator[k]) {
        validates.push(this.$validator[k](this.get(k), values))
      }
    })
    return promiseAll(validates)
  }

  validateClear() {
    const keys = Object.keys(this.$validator)
    this.$errors = {}
    const validates = keys.map(k => this.$validator[k](FORCE_PASS))
    Promise.all(validates)
  }
}
