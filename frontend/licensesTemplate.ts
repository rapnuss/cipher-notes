import {Dependency} from 'rollup-plugin-license'

export const licensesTemplate = (dependencies: Dependency[]) => `
<html lang="en">
<head>
  <title>Third Party Licenses - ciphernotes</title>
  <meta charset="utf-8">
  <style>
    html {
      font-family: sans-serif;
    }
    .table-container {
      overflow-x: auto;
    }
    table {
      border-collapse: collapse;
    }
    th, td {
      border: 1px solid #ccc;
      text-align: left;
      vertical-align: top;
    }
    pre {
      white-space: pre-wrap;
      width: 50em;
    }
  </style>
</head>
<body>
  <nav><a href="/">Back to the app</a></nav>
  <h1>Third Party Licenses - ciphernotes</h1>
  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Version</th>
          <th>License</th>
          <th>Private</th>
          <th>Description</th>
          <th>Repository</th>
          <th>Author</th>
          <th>License Copyright</th>
        </tr>
      </thead>
      <tbody>
        ${dependencies
          .map(
            (dep) => `
              <tr>
                <td>${dep.name}</td>
                <td>${dep.version}</td>
                <td>${dep.license}</td>
                <td>${dep.private}</td>
                <td>${dep.description}</td>
                <td>${
                  typeof dep.repository === 'string' ? dep.repository : dep.repository?.url
                }</td>
                <td>${dep.author?.name ?? ''} ${dep.author?.email ?? ''}</td>
                <td><pre>${dep.licenseText?.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></td>
              </tr>`
          )
          .join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`
