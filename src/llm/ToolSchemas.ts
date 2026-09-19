import { z } from 'zod';

export const ToolSchemas = [
  {
    type: 'function' as const,
    function: {
      name: 'browser_navigate',
      description: 'Navigates the browser to a specific URL.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The absolute URL to navigate to (e.g., "https://example.com").',
          },
        },
        required: ['url'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'browser_click',
      description:
        'Clicks an interactive element using its reference ID from the accessibility snapshot.',
      parameters: {
        type: 'object',
        properties: {
          ref: {
            type: 'string',
            description: 'The unique reference ID of the element to click (e.g. "v1:e3").',
          },
          element: {
            type: 'string',
            description: 'Brief human-readable description of the element for verification and logging.',
          },
          button: {
            type: 'string',
            enum: ['left', 'right', 'middle'],
            description: 'Mouse button to click with. Defaults to "left".',
          },
          clickCount: {
            type: 'number',
            description: 'Number of clicks (1 for single, 2 for double click). Defaults to 1.',
          },
        },
        required: ['ref'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'browser_type',
      description: 'Types text into an editable input or textarea element designated by its ref.',
      parameters: {
        type: 'object',
        properties: {
          ref: {
            type: 'string',
            description: 'The unique reference ID of the input field (e.g. "v1:e5").',
          },
          text: {
            type: 'string',
            description: 'The text string to type into the field.',
          },
          clear: {
            type: 'boolean',
            description: 'Whether to clear existing text before typing. Defaults to false.',
          },
          pressEnter: {
            type: 'boolean',
            description: 'Whether to press Enter after typing. Defaults to false.',
          },
        },
        required: ['ref', 'text'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'browser_fill_form',
      description: 'Fills multiple form fields in one batch action.',
      parameters: {
        type: 'object',
        properties: {
          fields: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                ref: { type: 'string', description: 'Reference ID of the input field.' },
                value: { type: 'string', description: 'Value to fill in.' },
              },
              required: ['ref', 'value'],
            },
            description: 'List of field reference IDs and values to populate.',
          },
        },
        required: ['fields'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'browser_hover',
      description: 'Hovers the mouse over an element identified by its ref.',
      parameters: {
        type: 'object',
        properties: {
          ref: {
            type: 'string',
            description: 'The reference ID of the element to hover over.',
          },
        },
        required: ['ref'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'browser_press_key',
      description: 'Presses a keyboard key (e.g. Enter, Escape, Tab, ArrowDown, Backspace).',
      parameters: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description: 'The key to press (e.g. "Enter", "Tab", "Escape").',
          },
        },
        required: ['key'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'browser_select_option',
      description: 'Selects an option from a dropdown combobox element.',
      parameters: {
        type: 'object',
        properties: {
          ref: {
            type: 'string',
            description: 'The reference ID of the select element.',
          },
          value: {
            type: 'string',
            description: 'The option label or value to select.',
          },
        },
        required: ['ref', 'value'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'browser_wait_for',
      description: 'Waits for a period of time or for specific text to become visible on the page.',
      parameters: {
        type: 'object',
        properties: {
          ms: {
            type: 'number',
            description: 'Milliseconds to wait (min 100, max 10000).',
          },
          text: {
            type: 'string',
            description: 'Optional text string to wait for before proceeding.',
          },
        },
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'browser_snapshot',
      description: 'Forces an immediate fresh accessibility snapshot of the current page.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'browser_done',
      description: 'Concludes the task when the objective has been fully achieved or answered.',
      parameters: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: 'Executive summary of actions taken.',
          },
          finalAnswer: {
            type: 'string',
            description: 'Complete, structured final answer fulfilling the user goal.',
          },
          sources: {
            type: 'array',
            items: { type: 'string' },
            description: 'URLs visited or cited in the response.',
          },
        },
        required: ['summary', 'finalAnswer'],
      },
    },
  },
];

export const ToolCallValidation = z.object({
  name: z.string(),
  arguments: z.record(z.any()),
});
