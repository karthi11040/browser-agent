// ============================================================================
// Action validator (Phase 3 of the spec)
//
// Runs BEFORE any action reaches the browser. Confirms:
//   1. The target element exists in the current PageState
//   2. The target is interactive (we already filtered on extract, but double-check)
//   3. The action type is permitted by the safety policy table
//
// Validation failures never reach Playwright. This is the gate that makes
// the agent auditable: every action either has a stored "valid: true" with
// reasons, or "valid: false" with the rule that failed.
// ============================================================================

import {
  type AgentActionType,
  type RiskLevel,
  classifyAction,
} from './safety-policy'
import { type PageElement, type PageState, findElement } from './dom-extract'

export interface AgentAction {
  type: AgentActionType
  // For click/type/etc: target identification
  ref?: string
  text?: string
  role?: string
  name?: string
  // For navigate
  url?: string
  // For type/press
  key?: string
  ms?: number
  // For high-risk contextual escalation (set by the safety classifier)
  intrinsicHigh?: boolean
  // Whether the user already confirmed this action (set by orchestrator
  // when resuming from a paused state after a confirmation token)
  confirmed?: boolean
}

export interface ValidationResult {
  valid: boolean
  risk: RiskLevel
  riskReason: string
  requiresConfirmation: boolean
  // When invalid, the rule that failed
  failureReason?: string
  // The element the action targets, when applicable
  targetElement?: PageElement
}

// Actions that target a specific element on the current page
const TARGETING_ACTIONS: ReadonlySet<AgentActionType> = new Set([
  'click',
  'click_text',
  'click_role',
  'type',
  'select',
  'check',
  'uncheck',
])

// Actions that don't need a target (page-level)
const PAGE_LEVEL_ACTIONS: ReadonlySet<AgentActionType> = new Set([
  'navigate',
  'extract',
  'wait',
  'scroll',
  'back',
  'press',
  'done',
  'reflect',
])

export function validateAction(
  action: AgentAction,
  state: PageState
): ValidationResult {
  // 1. Classify the action's risk level
  const classification = classifyAction({
    actionType: action.type,
    targetLabel: action.name ?? action.text,
    pageUrl: state.url,
    textValue: action.text,
  })

  const requiresConfirmation = classification.level === 'HIGH' && !action.confirmed

  // 2. For targeting actions, the target must exist in the current state
  if (TARGETING_ACTIONS.has(action.type)) {
    let target: PageElement | undefined

    if (action.ref) {
      target = findElement(state, { ref: action.ref })
      if (!target) {
        return {
          valid: false,
          risk: classification.level,
          riskReason: classification.reason,
          requiresConfirmation,
          failureReason: `Target ref ${action.ref} not found in current page state`,
        }
      }
    } else if (action.type === 'click_text' && action.text) {
      target = state.elements.find((el) =>
        el.name.toLowerCase().includes(action.text!.toLowerCase())
      )
      if (!target) {
        return {
          valid: false,
          risk: classification.level,
          riskReason: classification.reason,
          requiresConfirmation,
          failureReason: `No element with visible text matching "${action.text}"`,
        }
      }
      // Resolve the ref so the executor doesn't need to re-find it
      action.ref = target.ref
    } else if (action.type === 'click_role' && action.role && action.name) {
      target = findElement(state, {
        role: action.role,
        name: action.name,
      })
      if (!target) {
        return {
          valid: false,
          risk: classification.level,
          riskReason: classification.reason,
          requiresConfirmation,
          failureReason: `No element with role=${action.role} name~=${action.name}`,
        }
      }
      action.ref = target.ref
    } else if (action.type === 'type' && action.text !== undefined) {
      // Type with no ref — try to find a textbox
      target = state.elements.find((el) =>
        ['textbox', 'searchbox', 'combobox'].includes(el.role)
      )
      if (!target) {
        return {
          valid: false,
          risk: classification.level,
          riskReason: classification.reason,
          requiresConfirmation,
          failureReason: 'No textbox found in current page state to type into',
        }
      }
      action.ref = target.ref
    } else {
      return {
        valid: false,
        risk: classification.level,
        riskReason: classification.reason,
        requiresConfirmation,
        failureReason: `${action.type} requires either ref, text, or role+name`,
      }
    }

    return {
      valid: true,
      risk: classification.level,
      riskReason: classification.reason,
      requiresConfirmation,
      targetElement: target,
    }
  }

  // 3. Page-level actions
  if (action.type === 'navigate') {
    if (!action.url) {
      return {
        valid: false,
        risk: classification.level,
        riskReason: classification.reason,
        requiresConfirmation,
        failureReason: 'navigate requires a url',
      }
    }
    try {
      // Validate URL format
      new URL(action.url)
    } catch {
      return {
        valid: false,
        risk: classification.level,
        riskReason: classification.reason,
        requiresConfirmation,
        failureReason: `navigate url is not a valid URL: ${action.url}`,
      }
    }
    return {
      valid: true,
      risk: classification.level,
      riskReason: classification.reason,
      requiresConfirmation,
    }
  }

  if (action.type === 'press') {
    if (!action.key) {
      return {
        valid: false,
        risk: classification.level,
        riskReason: classification.reason,
        requiresConfirmation,
        failureReason: 'press requires a key',
      }
    }
    return {
      valid: true,
      risk: classification.level,
      riskReason: classification.reason,
      requiresConfirmation,
    }
  }

  if (action.type === 'wait') {
    return {
      valid: true,
      risk: classification.level,
      riskReason: classification.reason,
      requiresConfirmation,
    }
  }

  if (action.type === 'extract' || action.type === 'scroll' || action.type === 'back' || action.type === 'done' || action.type === 'reflect') {
    return {
      valid: true,
      risk: classification.level,
      riskReason: classification.reason,
      requiresConfirmation,
    }
  }

  if (PAGE_LEVEL_ACTIONS.has(action.type)) {
    return {
      valid: true,
      risk: classification.level,
      riskReason: classification.reason,
      requiresConfirmation,
    }
  }

  // High-risk intrinsic actions (post_comment, like, follow, etc.)
  // These are valid action types but they're always HIGH risk and require
  // confirmation. We don't actually have browser implementations for them
  // in this iteration — the orchestrator will refuse them with a clear
  // message that they require manual operation.
  if (classification.intrinsicHigh) {
    return {
      valid: false,
      risk: classification.level,
      riskReason: classification.reason,
      requiresConfirmation: true,
      failureReason: `${action.type} is a high-risk action type that is not implemented for autonomous execution in this iteration. The agent should describe the intended action and let the user perform it manually.`,
    }
  }

  return {
    valid: false,
    risk: classification.level,
    riskReason: classification.reason,
    requiresConfirmation,
    failureReason: `Unknown action type: ${action.type}`,
  }
}
