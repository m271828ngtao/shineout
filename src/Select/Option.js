import React, { PureComponent } from 'react'
import PropTypes from 'prop-types'
import { selectClass } from '../styles'

class Option extends PureComponent {
  constructor(props) {
    super(props)
    this.handleClick = this.handleClick.bind(this)
  }

  handleClick() {
    const {
      data, onClick, isActive, multiple,
    } = this.props

    if (isActive && !multiple) return

    onClick(!isActive, data)
  }

  render() {
    const {
      data, isActive, index, renderItem,
    } = this.props
    const className = selectClass('option', isActive && 'active')

    return (
      <a onClick={this.handleClick} className={className}>
        { renderItem(data, index) }
      </a>
    )
  }
}

Option.propTypes = {
  data: PropTypes.oneOfType([
    PropTypes.object,
    PropTypes.string,
  ]).isRequired,
  index: PropTypes.number,
  isActive: PropTypes.bool,
  multiple: PropTypes.bool,
  onClick: PropTypes.func,
  renderItem: PropTypes.func.isRequired,
}

export default Option
