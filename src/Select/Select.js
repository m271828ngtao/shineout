import React from 'react'
import PropTypes from 'prop-types'
import PureComponent from '../PureComponent'
import { getProps } from '../utils/proptypes'
import { getUidStr } from '../utils/uid'
import { selectClass } from '../styles'
import Result from './Result'
import { getLocale } from '../locale'
import OptionList from './OptionList'
import AbsoluteList from './AbsoluteList'

const isDescendent = (el, id) => {
  if (el.getAttribute('data-id') === id) return true
  if (!el.parentElement) return false
  return isDescendent(el.parentElement, id)
}

class Select extends PureComponent {
  constructor(props) {
    super(props)

    this.state = {
      control: 'mouse',
      focus: false,
      position: 'drop-down',
    }

    this.bindElement = this.bindElement.bind(this)
    this.bindOptionFunc = this.bindOptionFunc.bind(this)
    this.setInputReset = this.setInputReset.bind(this)

    this.handleFocus = this.handleState.bind(this, true)
    this.handleBlur = this.handleState.bind(this, false)
    this.handleClear = this.handleClear.bind(this)
    this.handleChange = this.handleChange.bind(this)
    this.handleRemove = this.handleChange.bind(this, false)
    this.handleKeyDown = this.handleKeyDown.bind(this)
    this.handleKeyUp = this.handleKeyUp.bind(this)
    this.handleInputFocus = this.handleInputFocus.bind(this)
    this.handleControlChange = this.handleControlChange.bind(this)
    this.handleClickAway = this.handleClickAway.bind(this)
    this.handleInputBlur = this.handleInputBlur.bind(this)

    this.renderItem = this.renderItem.bind(this)

    // option list not render till first focused
    this.renderPending = true

    this.optionList = {}
    this.selectId = `select_${getUidStr()}`

    this.lastResult = undefined
  }

  componentDidUpdate(prevProps, prevState) {
    const { onFilter } = this.props

    // clear filter
    if (prevState.focus !== this.state.focus && !this.state.focus && onFilter) {
      setTimeout(() => {
        onFilter('')
      }, 400)
    }
  }

  componentWillUnmount() {
    this.$willUnmount = true
    this.clearClickAway()
  }

  getText(key) {
    return this.props.text[key] || getLocale(key)
  }

  setInputReset(fn) {
    this.inputReset = fn
  }

  bindOptionFunc(name, fn) {
    this.optionList[name] = fn
  }

  bindElement(el) {
    this.element = el
  }

  bindClickAway() {
    document.addEventListener('click', this.handleClickAway)
  }

  clearClickAway() {
    document.removeEventListener('click', this.handleClickAway)
  }

  handleClickAway(e) {
    const desc = isDescendent(e.target, this.selectId)
    if (!desc) this.handleState(false)
  }

  handleState(focus) {
    if (this.props.disabled === true) return
    if (focus === this.state.focus) return

    const { onBlur, onFocus, height } = this.props
    let { position } = this.props
    const windowHeight = window.innerHeight || document.documentElement.clientHeight
    const bottom = height + this.element.getBoundingClientRect().bottom
    if (bottom > windowHeight && !position) position = 'drop-up'

    this.setState({ focus, position: position || 'drop-down' })

    if (focus) {
      this.bindClickAway()
      this.renderPending = false
      onFocus()
    } else {
      this.optionList.handleHover(undefined)
      this.clearClickAway()
      onBlur()
    }
  }

  handleControlChange(control) {
    if (control !== this.state.control) this.setState({ control })
  }

  handleChange(_, data) {
    const {
      datum, multiple, disabled,
    } = this.props
    if (disabled === true) return

    // if click option, ignore blur event
    if (this.inputBlurTimer) clearTimeout(this.inputBlurTimer)

    if (multiple) {
      const checked = !datum.check(data)
      if (checked) {
        datum.add(data)
      } else {
        datum.remove(data)
      }
      if (this.inputReset) this.inputReset()
    } else {
      datum.set(data)
      this.handleState(false)
    }
  }

  handleInputFocus() {
    this.inputLocked = true
    if (this.props.inputable && this.state.control === 'keyboard') {
      this.optionList.handleHover(0, true)
    }
  }

  handleInputBlur(text) {
    const { onCreate } = this.props
    if (!onCreate || !text) return

    // if click option, ignore input blur
    this.inputBlurTimer = setTimeout(() => {
      const data = onCreate(text)
      this.handleChange(null, data)
    }, 200)
  }

  handleClear() {
    this.props.datum.setValue([])

    if (this.$willUnmount) return
    if (this.state.focus === false) {
      this.forceUpdate()
    } else {
      this.handleState(false)
    }
  }

  handleEnter() {
    const hoverIndex = this.optionList.getIndex()
    const data = this.props.data[hoverIndex]
    if (data) {
      const checked = !this.props.datum.check(data)
      this.handleChange(checked, data)
    }
  }

  handleKeyDown(e) {
    this.keyLocked = true
    this.handleControlChange('keyboard')

    switch (e.keyCode) {
      case 38:
        this.optionList.hoverMove(-1)
        e.preventDefault()
        break
      case 40:
        this.optionList.hoverMove(1)
        e.preventDefault()
        break
      case 13:
        this.handleEnter()
        e.preventDefault()
        break
      default:
    }
  }

  handleKeyUp() {
    this.keyLocked = false
  }

  renderItem(data, index) {
    const { renderItem } = this.props
    return typeof renderItem === 'function'
      ? renderItem(data, index)
      : data[renderItem]
  }

  renderOptions() {
    const { focus, control, position } = this.state

    const props = {};
    (['data', 'datum', 'keygen', 'multiple', 'text', 'itemsInView', 'absolute', 'lineHeight', 'height', 'loading'])
      .forEach((k) => { props[k] = this.props[k] })

    const List = props.absolute ? AbsoluteList : OptionList

    return (
      <List
        {...props}
        bindOptionFunc={this.bindOptionFunc}
        renderPending={this.renderPending}
        focus={focus}
        control={control}
        selectId={this.selectId}
        onControlChange={this.handleControlChange}
        onChange={this.handleChange}
        renderItem={this.renderItem}
        parentElement={this.element}
        position={position}
        onBlur={this.handleBlur}
      />
    )
  }

  render() {
    const {
      placeholder, multiple, clearable, disabled, size, onFilter, datum, filterText, onCreate, result,
    } = this.props
    const className = selectClass(
      'inner',
      size,
      this.state.focus && 'focus',
      this.state.position,
      multiple && 'multiple',
      disabled === true && 'disabled',
    )
    const renderResult = this.props.renderResult || this.renderItem

    return (
      <div
        tabIndex={-1}
        ref={this.bindElement}
        className={className}
        data-id={this.selectId}
        // onFocus={this.handleFocus}
        onClick={this.handleFocus}
        onKeyDown={this.handleKeyDown}
        onKeyUp={this.handleKeyUp}
      >
        <Result
          filterText={filterText}
          onClear={clearable ? this.handleClear : undefined}
          onCreate={onCreate}
          onRemove={this.handleRemove}
          onFilter={onFilter}
          datum={datum}
          disabled={disabled}
          focus={this.state.focus}
          result={result}
          multiple={multiple}
          placeholder={placeholder}
          renderResult={renderResult}
          onInputBlur={this.handleInputBlur}
          onInputFocus={this.handleInputFocus}
          setInputReset={this.setInputReset}
        />
        { this.renderOptions() }
      </div>
    )
  }
}

Select.propTypes = {
  ...getProps(PropTypes, 'placehodler', 'keygen'),
  absolute: PropTypes.bool,
  clearable: PropTypes.bool,
  data: PropTypes.array,
  datum: PropTypes.object.isRequired,
  disabled: PropTypes.oneOfType([
    PropTypes.bool,
    PropTypes.func,
  ]),
  filterText: PropTypes.string,
  height: PropTypes.number,
  itemsInView: PropTypes.number,
  lineHeight: PropTypes.number,
  loading: PropTypes.oneOfType([
    PropTypes.element,
    PropTypes.bool,
  ]),
  multiple: PropTypes.bool,
  onBlur: PropTypes.func,
  onCreate: PropTypes.func,
  onFilter: PropTypes.func,
  onFocus: PropTypes.func,
  position: PropTypes.string,
  renderItem: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.func,
  ]),
  result: PropTypes.array,
  size: PropTypes.string,
  text: PropTypes.object,
}

Select.defaultProps = {
  clearable: false,
  data: [],
  height: 250,
  itemsInView: 10,
  lineHeight: 32,
  loading: false,
  multiple: false,
  renderItem: e => e,
  text: {},
}

export default Select
