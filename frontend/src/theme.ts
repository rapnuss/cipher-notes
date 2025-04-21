import {createTheme} from '@mantine/core'

export const theme = createTheme({
  components: {
    Drawer: {
      defaultProps: {
        lockScroll: false,
      },
    },
    Modal: {
      defaultProps: {
        lockScroll: false,
        closeButtonProps: {
          title: 'Close dialog',
        },
      },
    },
  },
})
